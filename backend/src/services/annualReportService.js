import mongoose from 'mongoose';
import Activity from '../models/Activity.js';
import ActivityReport from '../models/ActivityReport.js';
import Attendance from '../models/Attendance.js';
import Media from '../models/Media.js';
import Document from '../models/Document.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import AnnualReport from '../models/AnnualReport.js';
import Notification from '../models/Notification.js';
import storageService from '../utils/storageService.js';
import { logAudit } from '../utils/auditLogger.js';
import {
  calculateAcademicYear,
  normalizeAcademicYear,
  getAcademicYearDateRange,
  getAvailableAcademicYears
} from '../utils/academicYear.js';
import { processActivityDocuments } from './documentExtractorService.js';
import { buildOfficialAnnualReportPDF } from './annualReportPdfService.js';

/**
 * Annual Report Service for ActivityTracker RCPIT
 * Enforces mandatory Database → Service → Controller → API → Frontend architecture
 * Strict rule: ONLY HOD-VERIFIED activities are eligible for official annual reporting.
 */

/**
 * 1. Get available academic years
 */
export const getAvailableAcademicYearsService = () => {
  return {
    academicYears: getAvailableAcademicYears(),
    currentAcademicYear: calculateAcademicYear(new Date())
  };
};

/**
 * Helper: Authorize and resolve department ID with strict HOD isolation
 */
const resolveAuthorizedDepartmentId = (user, requestedDeptId) => {
  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();

  if (user.role === 'HOD') {
    if (!userDeptId) {
      const err = new Error('HOD account is not linked to any academic department.');
      err.statusCode = 403;
      throw err;
    }
    // Prevent HOD from accessing any other department
    if (requestedDeptId && requestedDeptId.toString() !== userDeptId) {
      const err = new Error('Access Denied: HOD can only access their own department annual reports.');
      err.statusCode = 403;
      throw err;
    }
    return userDeptId;
  }

  if (['ADMIN', 'DIRECTOR'].includes(user.role)) {
    return requestedDeptId || null;
  }

  const err = new Error('Unauthorized: Only HOD, Admin, and Director can access annual reports.');
  err.statusCode = 403;
  throw err;
};

/**
 * 2. Get Annual Report Readiness & Eligibility Breakdown
 */
export const getAnnualReportReadinessService = async ({ departmentId: reqDeptId, academicYear, user }) => {
  const targetDeptId = resolveAuthorizedDepartmentId(user, reqDeptId);
  const { startDate, endDate, academicYear: normAY } = getAcademicYearDateRange(academicYear);

  // Department information
  let department = null;
  if (targetDeptId) {
    department = await Department.findById(targetDeptId).populate('hodId', 'name email designation');
    if (!department) {
      const err = new Error('Department not found.');
      err.statusCode = 404;
      throw err;
    }
  }

  // Base query for activities falling within the academic year
  const actQuery = {
    date: { $gte: startDate, $lte: endDate },
    status: { $ne: 'DRAFT' }
  };
  if (targetDeptId) {
    actQuery.departmentId = targetDeptId;
  }

  const activities = await Activity.find(actQuery)
    .populate('coordinatorId', 'name email designation employeeId')
    .populate('venueId', 'name location capacity')
    .populate('departmentId', 'name code')
    .sort({ date: 1 });

  const actIds = activities.map(a => a._id);

  // Fetch all associated ActivityReports for these activities
  const reports = await ActivityReport.find({ activityId: { $in: actIds } })
    .populate('reviewedBy', 'name email designation role');

  const reportMap = new Map();
  reports.forEach(r => reportMap.set(r.activityId.toString(), r));

  // Fetch media & document counts for supplementary completeness
  const mediaRecords = await Media.find({ activityId: { $in: actIds } });
  const mediaCountMap = new Map();
  mediaRecords.forEach(m => {
    const k = m.activityId.toString();
    mediaCountMap.set(k, (mediaCountMap.get(k) || 0) + 1);
  });

  const docRecords = await Document.find({ activityId: { $in: actIds } });
  const docCountMap = new Map();
  docRecords.forEach(d => {
    const k = d.activityId.toString();
    docCountMap.set(k, (docCountMap.get(k) || 0) + 1);
  });

  // Categorize activities strictly according to HOD verification eligibility
  const eligibleActivities = [];
  const pendingVerificationActivities = [];
  const missingReportActivities = [];
  const changesRequiredActivities = [];
  const excludedActivities = [];
  const missingSupplementaryDocs = [];

  for (const act of activities) {
    const r = reportMap.get(act._id.toString());
    const isCancelledOrRejected = act.status === 'REJECTED' || act.status === 'CANCELLED';

    if (isCancelledOrRejected) {
      excludedActivities.push({
        activity: act,
        reason: act.status === 'REJECTED' ? (act.rejectionReason || 'Proposal rejected') : (act.cancellationReason || 'Booking cancelled')
      });
      continue;
    }

    // STRICT ELIGIBILITY CHECK:
    // Has a submitted report with status === 'VERIFIED' and reviewedBy != null
    const isHodVerified = r && r.status === 'VERIFIED' && r.reviewedBy;

    if (isHodVerified) {
      // Retains eligibility even if current activity status is COMPLETED, LOCKED, or ARCHIVED
      eligibleActivities.push({
        activity: act,
        report: r,
        verifiedBy: r.reviewedBy,
        verifiedAt: r.reviewedAt,
        photosCount: mediaCountMap.get(act._id.toString()) || 0,
        documentsCount: docCountMap.get(act._id.toString()) || 0
      });

      // Check supplementary documents
      const photos = mediaCountMap.get(act._id.toString()) || 0;
      const docs = docCountMap.get(act._id.toString()) || 0;
      if (photos === 0 || docs === 0) {
        missingSupplementaryDocs.push({
          activityId: act._id,
          title: act.title,
          date: act.date,
          missingPhotos: photos === 0,
          missingDocs: docs === 0
        });
      }
    } else if (r && r.status === 'SUBMITTED') {
      pendingVerificationActivities.push({
        activity: act,
        report: r,
        submittedAt: r.updatedAt
      });
    } else if (r && r.status === 'CHANGES_REQUIRED') {
      changesRequiredActivities.push({
        activity: act,
        report: r,
        feedback: r.rejectionReason
      });
    } else {
      missingReportActivities.push({
        activity: act,
        status: act.status
      });
    }
  }

  // Calculate conducted vs eligible
  const totalConducted = eligibleActivities.length + pendingVerificationActivities.length + missingReportActivities.length + changesRequiredActivities.length;
  const readinessScore = totalConducted > 0 ? Math.round((eligibleActivities.length / totalConducted) * 100) : 100;

  // Check if an existing AnnualReport record is present
  const existingReport = await AnnualReport.findOne({
    departmentId: targetDeptId || null,
    academicYear: normAY,
    reportType: targetDeptId ? 'DEPARTMENT' : 'INSTITUTIONAL'
  }).populate('verifiedBy', 'name email designation').populate('generatedBy', 'name email designation');

  return {
    success: true,
    academicYear: normAY,
    department: department ? { _id: department._id, name: department.name, code: department.code, hod: department.hodId } : null,
    readiness: {
      totalActivities: activities.length,
      totalConducted,
      eligibleCount: eligibleActivities.length,
      pendingVerificationCount: pendingVerificationActivities.length,
      missingReportsCount: missingReportActivities.length,
      changesRequiredCount: changesRequiredActivities.length,
      excludedCount: excludedActivities.length,
      readinessScore,
      missingSupplementaryCount: missingSupplementaryDocs.length
    },
    eligibleActivities,
    pendingVerificationActivities,
    missingReportActivities,
    changesRequiredActivities,
    excludedActivities,
    missingSupplementaryDocs,
    existingReport
  };
};

/**
 * 3. Generate or Update Annual Report Draft
 */
export const generateAnnualReportDraftService = async ({ departmentId: reqDeptId, academicYear, user, req }) => {
  const targetDeptId = resolveAuthorizedDepartmentId(user, reqDeptId);
  const { startDate, endDate, academicYear: normAY } = getAcademicYearDateRange(academicYear);

  let department = null;
  if (targetDeptId) {
    department = await Department.findById(targetDeptId).populate('hodId');
    if (!department) {
      const err = new Error('Department not found.');
      err.statusCode = 404;
      throw err;
    }
  }

  // Fetch only eligible HOD-verified activities
  const actQuery = {
    date: { $gte: startDate, $lte: endDate },
    status: { $nin: ['REJECTED', 'CANCELLED', 'DRAFT'] }
  };
  if (targetDeptId) actQuery.departmentId = targetDeptId;

  const candidateActivities = await Activity.find(actQuery)
    .populate('coordinatorId', 'name email designation employeeId departmentId')
    .populate('coCoordinators', 'name email designation')
    .populate('venueId', 'name location capacity')
    .populate('departmentId', 'name code')
    .sort({ date: 1 });

  const candidateIds = candidateActivities.map(a => a._id);

  // Find verified ActivityReport records
  const verifiedReports = await ActivityReport.find({
    activityId: { $in: candidateIds },
    status: 'VERIFIED'
  }).populate('reviewedBy', 'name email designation');

  const verifiedReportMap = new Map();
  verifiedReports.forEach(r => verifiedReportMap.set(r.activityId.toString(), r));

  // Filter strictly eligible activities
  const eligibleActivities = candidateActivities.filter(a => verifiedReportMap.has(a._id.toString()));
  const eligibleIds = eligibleActivities.map(a => a._id);

  // 1. Attendance Aggregation
  const attendanceRecords = await Attendance.find({
    activityId: { $in: eligibleIds },
    attendanceStatus: 'PRESENT'
  });

  const uniqueParticipantSet = new Set();
  let studentCount = 0;
  let facultyCount = 0;
  let externalCount = 0;

  attendanceRecords.forEach(att => {
    const uniqueKey = att.participantId || att.email || att.participantName;
    if (uniqueKey) uniqueParticipantSet.add(uniqueKey.toLowerCase());

    if (att.participantType === 'STUDENT') studentCount++;
    else if (att.participantType === 'FACULTY') facultyCount++;
    else externalCount++;
  });

  // 2. Category Distribution & Monthly Trends
  const categoryBreakdown = {};
  const monthlyBreakdown = {};
  let totalEstimatedBudget = 0;
  let totalActualExpenditure = 0;

  eligibleActivities.forEach(act => {
    categoryBreakdown[act.category] = (categoryBreakdown[act.category] || 0) + 1;
    const monthName = new Date(act.date).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    monthlyBreakdown[monthName] = (monthlyBreakdown[monthName] || 0) + 1;

    totalEstimatedBudget += (act.estimatedBudget || 0);
    totalActualExpenditure += (act.actualExpenditure || 0);
  });

  // 3. Faculty Contributions
  const facultyMap = new Map();
  eligibleActivities.forEach(act => {
    const c = act.coordinatorId;
    if (c && c._id) {
      const cid = c._id.toString();
      if (!facultyMap.has(cid)) {
        facultyMap.set(cid, {
          id: c._id,
          name: c.name,
          designation: c.designation || 'Faculty Member',
          email: c.email,
          activitiesCoordinated: []
        });
      }
      facultyMap.get(cid).activitiesCoordinated.push({
        id: act._id,
        title: act.title,
        category: act.category,
        date: act.date
      });
    }
  });

  const facultyContributions = Array.from(facultyMap.values());

  // 4. Document Processing & Information Extraction
  const allDocs = await Document.find({ activityId: { $in: eligibleIds } });
  const allMedia = await Media.find({ activityId: { $in: eligibleIds }, mediaType: { $in: ['IMAGE', 'image'] } });

  const extractedDocumentData = [];
  for (const act of eligibleActivities) {
    const actDocs = allDocs.filter(d => d.activityId.toString() === act._id.toString());
    const actReport = verifiedReportMap.get(act._id.toString());
    if (actDocs.length > 0) {
      const actExtracted = await processActivityDocuments(act, actDocs, actReport);
      extractedDocumentData.push(...actExtracted);
    }
  }

  // 5. Build Default Narrative
  const deptTitle = department ? department.name : 'All Academic Departments';
  const defaultExecutiveSummary = `During academic year ${normAY}, the ${deptTitle} conducted a total of ${eligibleActivities.length} verified activities. These events registered ${attendanceRecords.length} student and faculty participations across multiple technical, skill-enhancement, and professional domains. All included records adhere strictly to IQAC guidelines and post-event verification standards.`;

  const defaultDepartmentOverview = department?.description ||
    `The ${deptTitle} at R. C. Patel Institute of Technology, Shirpur focuses on comprehensive academic excellence, cutting-edge technical initiatives, and industry alignment. This annual report compiles certified evidence for departmental review and accreditation documentation.`;

  const defaultConclusion = `The academic session ${normAY} concluded with notable student outcomes, enhanced technical capabilities, and successful execution of proposed departmental milestones. The department remains dedicated to continuous quality improvement in accordance with autonomous institutional standards.`;

  // Find or Create AnnualReport record
  let annualReport = await AnnualReport.findOne({
    departmentId: targetDeptId || null,
    academicYear: normAY,
    reportType: targetDeptId ? 'DEPARTMENT' : 'INSTITUTIONAL'
  });

  const statisticsData = {
    totalActivities: eligibleActivities.length,
    categoryBreakdown,
    totalAttendanceRecords: attendanceRecords.length,
    uniqueParticipantsCount: uniqueParticipantSet.size || attendanceRecords.length,
    studentParticipantsCount: studentCount,
    facultyParticipantsCount: facultyCount,
    externalParticipantsCount: externalCount,
    monthlyBreakdown,
    totalEstimatedBudget,
    totalActualExpenditure
  };

  const readinessSnapshot = {
    totalConducted: candidateActivities.length,
    eligibleCount: eligibleActivities.length,
    pendingVerificationCount: candidateActivities.length - eligibleActivities.length,
    missingReportsCount: candidateActivities.length - verifiedReports.length,
    excludedCount: 0,
    readinessScore: candidateActivities.length > 0 ? Math.round((eligibleActivities.length / candidateActivities.length) * 100) : 100
  };

  const draftContentData = {
    department: department ? { _id: department._id, name: department.name, code: department.code } : null,
    academicYear: normAY,
    eligibleActivities: eligibleActivities.map(a => ({
      _id: a._id,
      title: a.title,
      category: a.category,
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      isAllDay: a.isAllDay,
      venueName: a.venueName,
      coordinator: a.coordinatorId ? { name: a.coordinatorId.name, email: a.coordinatorId.email } : null,
      expectedParticipants: a.expectedParticipants,
      actualParticipants: verifiedReportMap.get(a._id.toString())?.actualParticipants || a.expectedParticipants,
      description: a.description,
      objectives: a.objectives,
      outcomes: verifiedReportMap.get(a._id.toString())?.outcomes || 'Successfully achieved proposed learning objectives.',
      achievements: verifiedReportMap.get(a._id.toString())?.achievements || 'Certified participation and skill enhancements.',
      verifiedBy: verifiedReportMap.get(a._id.toString())?.reviewedBy?.name || 'HOD',
      verifiedAt: verifiedReportMap.get(a._id.toString())?.reviewedAt
    })),
    statistics: statisticsData,
    facultyContributions,
    verifiedMedia: allMedia.slice(0, 12).map(m => ({
      _id: m._id,
      activityId: m.activityId,
      fileName: m.fileName,
      fileUrl: m.fileUrl,
      caption: m.caption
    })),
    supportingDocs: allDocs.map(d => ({
      _id: d._id,
      activityId: d.activityId,
      fileName: d.fileName,
      documentType: d.documentType,
      fileUrl: d.fileUrl
    }))
  };

  if (annualReport) {
    annualReport.eligibleActivityIds = eligibleIds;
    annualReport.readinessSnapshot = readinessSnapshot;
    annualReport.statistics = statisticsData;
    annualReport.extractedDocumentData = extractedDocumentData;
    annualReport.draftContent = draftContentData;
    if (!annualReport.narrativeContent.executiveSummary) {
      annualReport.narrativeContent.executiveSummary = defaultExecutiveSummary;
      annualReport.narrativeContent.departmentOverview = defaultDepartmentOverview;
      annualReport.narrativeContent.annualConclusion = defaultConclusion;
    }
    await annualReport.save();
  } else {
    annualReport = await AnnualReport.create({
      reportType: targetDeptId ? 'DEPARTMENT' : 'INSTITUTIONAL',
      departmentId: targetDeptId || null,
      academicYear: normAY,
      status: 'DRAFT',
      version: 1,
      eligibleActivityIds: eligibleIds,
      readinessSnapshot,
      statistics: statisticsData,
      extractedDocumentData,
      narrativeContent: {
        executiveSummary: defaultExecutiveSummary,
        departmentOverview: defaultDepartmentOverview,
        annualConclusion: defaultConclusion,
        facultyContributionsSummary: 'Faculty members led and coordinated events with institutional diligence.',
        achievementsHighlights: 'Documented student hackathon wins, technical certifications, and publication achievements.'
      },
      draftContent: draftContentData,
      generatedBy: user._id,
      generatedAt: new Date()
    });
  }

  await logAudit({
    req,
    user,
    action: 'ANNUAL_REPORT_DRAFT_GENERATED',
    entity: 'AnnualReport',
    entityId: annualReport._id,
    details: `Draft created for ${normAY} with ${eligibleActivities.length} verified activities`
  });

  return annualReport;
};

/**
 * 4. Update Report Narrative (Executive summary, overview, conclusion)
 */
export const updateAnnualReportNarrativeService = async ({ reportId, narrativeContent, user, req }) => {
  const report = await AnnualReport.findById(reportId);
  if (!report) {
    const err = new Error('Annual report not found');
    err.statusCode = 404;
    throw err;
  }

  // Authorization check
  resolveAuthorizedDepartmentId(user, report.departmentId);

  if (report.status === 'OFFICIAL_GENERATED' && user.role !== 'ADMIN') {
    const err = new Error('Official report is generated. Modifications require regenerating an official version.');
    err.statusCode = 400;
    throw err;
  }

  report.narrativeContent = {
    ...report.narrativeContent,
    ...narrativeContent
  };
  await report.save();

  await logAudit({
    req,
    user,
    action: 'ANNUAL_REPORT_NARRATIVE_UPDATED',
    entity: 'AnnualReport',
    entityId: report._id,
    details: `Narrative updated by ${user.name}`
  });

  return report;
};

/**
 * 5. Verify Annual Report Draft by HOD
 */
export const verifyAnnualReportDraftService = async ({ reportId, verificationNotes, user, req }) => {
  const report = await AnnualReport.findById(reportId).populate('departmentId');
  if (!report) {
    const err = new Error('Annual report not found');
    err.statusCode = 404;
    throw err;
  }

  // Strict HOD department check
  if (user.role === 'HOD') {
    resolveAuthorizedDepartmentId(user, report.departmentId?._id || report.departmentId);
  } else if (user.role !== 'ADMIN') {
    const err = new Error('Only the Department HOD or Admin can verify the annual report.');
    err.statusCode = 403;
    throw err;
  }

  report.status = 'HOD_VERIFIED';
  report.verifiedBy = user._id;
  report.verifiedAt = new Date();
  report.verificationNotes = verificationNotes || 'HOD verified and recommended for official institutional publication.';
  await report.save();

  // Notify Admins
  const admins = await User.find({ role: 'ADMIN', status: { $in: ['APPROVED', 'ACTIVE'] } });
  for (const adm of admins) {
    await Notification.createIdempotent({
      recipientId: adm._id,
      senderId: user._id,
      title: 'Department Annual Report Verified by HOD',
      message: `HOD of ${report.departmentId?.name || 'Department'} verified the Annual Report for ${report.academicYear}.`,
      category: 'Approval',
      priority: 'HIGH',
      link: `/admin/annual-reports`
    });
  }

  await logAudit({
    req,
    user,
    action: 'ANNUAL_REPORT_HOD_VERIFIED',
    entity: 'AnnualReport',
    entityId: report._id,
    details: `Annual Report for ${report.academicYear} verified by ${user.name}`
  });

  return report;
};

/**
 * 6. Generate Official Publication PDF and Manage Versions
 */
export const generateOfficialAnnualReportPDFService = async ({ reportId, user, req }) => {
  const report = await AnnualReport.findById(reportId)
    .populate('departmentId')
    .populate('verifiedBy')
    .populate('generatedBy');

  if (!report) {
    const err = new Error('Annual report not found');
    err.statusCode = 404;
    throw err;
  }

  // Authorization check
  if (user.role === 'HOD') {
    resolveAuthorizedDepartmentId(user, report.departmentId?._id || report.departmentId);
  } else if (!['ADMIN', 'DIRECTOR'].includes(user.role)) {
    const err = new Error('Unauthorized to generate official annual report PDF');
    err.statusCode = 403;
    throw err;
  }

  // Enforce HOD Verification rule
  if (report.status === 'DRAFT' && user.role !== 'ADMIN') {
    const err = new Error('Annual report must be verified by the HOD before generating the official institutional PDF.');
    err.statusCode = 400;
    throw err;
  }

  const dept = report.departmentId;
  const isInstitutional = report.reportType === 'INSTITUTIONAL';

  // Fetch full details of eligible activities
  const eligibleActivities = await Activity.find({ _id: { $in: report.eligibleActivityIds } })
    .populate('coordinatorId')
    .populate('venueId')
    .populate('departmentId')
    .sort({ date: 1 });

  const allMedia = await Media.find({ activityId: { $in: report.eligibleActivityIds }, mediaType: { $in: ['IMAGE', 'image'] } });
  const allDocs = await Document.find({ activityId: { $in: report.eligibleActivityIds } });

  // Fetch HOD & Director
  let hodUser = report.verifiedBy || dept?.hodId;
  if (!hodUser && dept) {
    hodUser = await User.findOne({ departmentId: dept._id, role: 'HOD' });
  }

  let director = await User.findOne({ role: 'DIRECTOR' });
  if (!director) {
    director = {
      name: 'Dr. P. J. Patel',
      designation: 'Director',
      email: 'director@rcpit.ac.in'
    };
  }

  // Calculate Next Version Number
  let nextVersion = report.version || 1;
  if (report.status === 'OFFICIAL_GENERATED') {
    // If regenerating, archive previous version
    if (report.pdfUrl) {
      report.versionHistory.push({
        version: report.version,
        pdfUrl: report.pdfUrl,
        pdfFileName: report.pdfFileName,
        pdfFileSize: report.pdfFileSize,
        generatedBy: report.generatedBy?._id || report.generatedBy,
        generatedAt: report.generatedAt,
        verifiedBy: report.verifiedBy?._id || report.verifiedBy,
        verifiedAt: report.verifiedAt,
        sourceActivitiesCount: report.eligibleActivityIds.length
      });
    }
    nextVersion = (report.version || 1) + 1;
  }

  const deptCode = isInstitutional ? 'INSTITUTIONAL' : (dept?.code || 'DEPT');
  const cleanAY = report.academicYear.replace(/[^a-zA-Z0-9]/g, '_');
  const pdfFileName = `${deptCode}_Annual_Report_${cleanAY}_v${nextVersion}.pdf`;

  // Build PDF buffer
  const pdfBuffer = await buildOfficialAnnualReportPDF({
    reportRecord: { ...report.toObject(), version: nextVersion },
    department: dept,
    academicYear: report.academicYear,
    eligibleActivities,
    statistics: report.statistics || {},
    extractedDocumentData: report.extractedDocumentData || [],
    narrativeContent: report.narrativeContent || {},
    verifiedMedia: allMedia,
    supportingDocs: allDocs,
    hod: hodUser,
    director,
    isInstitutional
  });

  // Upload to storage
  const fileObject = {
    originalname: pdfFileName,
    buffer: pdfBuffer,
    mimetype: 'application/pdf',
    size: pdfBuffer.length
  };

  const { fileUrl } = await storageService.upload(fileObject, 'annual-reports');

  // Update report record
  report.version = nextVersion;
  report.status = 'OFFICIAL_GENERATED';
  report.pdfUrl = fileUrl;
  report.pdfFileName = pdfFileName;
  report.pdfFileSize = pdfBuffer.length;
  report.generatedBy = user._id;
  report.generatedAt = new Date();
  report.isOutdated = false;
  report.outdatedReason = '';
  await report.save();

  await logAudit({
    req,
    user,
    action: 'OFFICIAL_ANNUAL_REPORT_PDF_GENERATED',
    entity: 'AnnualReport',
    entityId: report._id,
    details: `Official PDF ${pdfFileName} generated (v${nextVersion})`
  });

  return report;
};

/**
 * 7. Admin Centralized Overview across All Departments
 */
export const getAdminAnnualReportsOverviewService = async ({ academicYear, user }) => {
  if (!['ADMIN', 'DIRECTOR'].includes(user.role)) {
    const err = new Error('Access denied: Admin role required for centralized institutional overview.');
    err.statusCode = 403;
    throw err;
  }

  const { startDate, endDate, academicYear: normAY } = getAcademicYearDateRange(academicYear);
  const departments = await Department.find({ isActive: true }).populate('hodId', 'name email designation').sort({ name: 1 });

  const departmentOverviews = [];
  let institutionalTotalActivities = 0;
  let institutionalTotalEligible = 0;
  let institutionalTotalParticipants = 0;

  for (const dept of departments) {
    const deptActivities = await Activity.find({
      departmentId: dept._id,
      date: { $gte: startDate, $lte: endDate },
      status: { $ne: 'DRAFT' }
    });

    const actIds = deptActivities.map(a => a._id);
    const verifiedReports = await ActivityReport.find({
      activityId: { $in: actIds },
      status: 'VERIFIED'
    });

    const verifiedActIds = new Set(verifiedReports.map(r => r.activityId.toString()));
    const eligibleCount = deptActivities.filter(a => verifiedActIds.has(a._id.toString()) && a.status !== 'REJECTED' && a.status !== 'CANCELLED').length;
    const pendingCount = deptActivities.length - eligibleCount;

    // Check existing AnnualReport
    const annualReport = await AnnualReport.findOne({
      departmentId: dept._id,
      academicYear: normAY,
      reportType: 'DEPARTMENT'
    });

    const participants = deptActivities.reduce((acc, curr) => acc + (curr.expectedParticipants || 50), 0);

    institutionalTotalActivities += deptActivities.length;
    institutionalTotalEligible += eligibleCount;
    institutionalTotalParticipants += participants;

    departmentOverviews.push({
      department: {
        _id: dept._id,
        name: dept.name,
        code: dept.code,
        hod: dept.hodId
      },
      totalActivities: deptActivities.length,
      eligibleCount,
      pendingCount,
      status: annualReport ? annualReport.status : 'NOT_STARTED',
      reportId: annualReport ? annualReport._id : null,
      version: annualReport ? annualReport.version : 0,
      pdfUrl: annualReport ? annualReport.pdfUrl : null,
      readinessScore: deptActivities.length > 0 ? Math.round((eligibleCount / deptActivities.length) * 100) : 100
    });
  }

  // Check Institutional Consolidated Report status
  const institutionalReport = await AnnualReport.findOne({
    reportType: 'INSTITUTIONAL',
    academicYear: normAY
  }).populate('generatedBy', 'name');

  return {
    success: true,
    academicYear: normAY,
    institutionalSummary: {
      totalDepartments: departments.length,
      totalActivities: institutionalTotalActivities,
      totalEligible: institutionalTotalEligible,
      totalParticipants: institutionalTotalParticipants,
      institutionalReportStatus: institutionalReport ? institutionalReport.status : 'NOT_STARTED',
      institutionalReportId: institutionalReport ? institutionalReport._id : null,
      institutionalPdfUrl: institutionalReport ? institutionalReport.pdfUrl : null,
      institutionalVersion: institutionalReport ? institutionalReport.version : 0
    },
    departments: departmentOverviews
  };
};

/**
 * 8. Admin Consolidated Institutional Report Draft Generation
 */
export const generateConsolidatedInstitutionalDraftService = async ({ academicYear, user, req }) => {
  if (!['ADMIN', 'DIRECTOR'].includes(user.role)) {
    const err = new Error('Access denied: Admin role required to compile consolidated institutional report.');
    err.statusCode = 403;
    throw err;
  }

  return generateAnnualReportDraftService({
    departmentId: null, // null indicates institutional scope
    academicYear,
    user,
    req
  });
};

