import Activity from '../models/Activity.js';
import ActivityReport from '../models/ActivityReport.js';
import Attendance from '../models/Attendance.js';
import Media from '../models/Media.js';
import Document from '../models/Document.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import ActivityApproval from '../models/ActivityApproval.js';
import storageService from '../utils/storageService.js';
import { buildOfficialActivityPDF } from './pdfService.js';
import { calculateCompletenessScore } from '../utils/completenessCalculator.js';
import { getOrGenerateReportId } from '../utils/reportIdGenerator.js';
import { logAudit } from '../utils/auditLogger.js';

/**
 * Report Generation Service
 * Orchestrates PDF creation, storage, versioning, and document database records
 */
export const generateAndStoreOfficialPDF = async ({ activityId, user, req }) => {
  const activity = await Activity.findById(activityId)
    .populate('departmentId')
    .populate('coordinatorId')
    .populate('coCoordinators')
    .populate('hodId')
    .populate('venueId');

  if (!activity) {
    throw new Error('Activity record not found');
  }

  // 1. Fetch Particular Staff / Faculty Coordinator
  let coordinator = activity.coordinatorId;
  if (!coordinator?.name && activity.coordinatorId) {
    coordinator = await User.findById(activity.coordinatorId);
  }

  // 2. Fetch Department and HOD for this specific department
  const deptId = activity.departmentId?._id || activity.departmentId;
  let department = activity.departmentId;
  if (!department?.name && deptId) {
    department = await Department.findById(deptId).populate('hodId');
  } else if (department && !department.hodId && deptId) {
    const fullDept = await Department.findById(deptId).populate('hodId');
    if (fullDept?.hodId) department = fullDept;
  }

  let hod = department?.hodId || activity.hodId;
  if (!hod?.name && deptId) {
    hod = await User.findOne({ departmentId: deptId, role: 'HOD' });
  }
  if (!hod?.name) {
    hod = await User.findOne({ role: 'HOD' });
  }

  // 3. Fetch Director of RCPIT
  let director = await User.findOne({ role: 'DIRECTOR' });
  if (!director) {
    director = {
      name: 'Dr. P. J. Patel',
      designation: 'Director',
      email: 'director@rcpit.ac.in',
      phone: '+91 2563 259802'
    };
  }

  // 4. Fetch Post-Event Report (if present)
  const report = await ActivityReport.findOne({ activityId });

  // 5. Authorization Check: Coordinators, HODs, Directors, Admins can view/generate
  const isCoordinator = (activity.coordinatorId?._id || activity.coordinatorId)?.toString() === user._id.toString();
  const isAuthorizedRole = ['ADMIN', 'DIRECTOR', 'HOD'].includes(user.role);
  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = deptId?.toString();
  const isSameDept = userDeptId && actDeptId && userDeptId === actDeptId;

  if (!isAuthorizedRole && !isCoordinator && !isSameDept) {
    throw new Error('You are not authorized to generate the PDF report for this activity.');
  }

  // 6. Fetch Attendance, Media, Approvals, Completeness Score
  const attendanceRecords = await Attendance.find({ activityId }).sort({ createdAt: 1, _id: 1 });
  const verifiedMedia = await Media.find({ activityId });
  const completenessScore = await calculateCompletenessScore(activityId);
  const approvals = await ActivityApproval.find({ activityId })
    .populate('performedBy', 'name role designation')
    .sort({ createdAt: 1 });

  // 7. Generate Report ID
  const reportId = await getOrGenerateReportId(activity);

  // 8. Build Official PDF Buffer
  const pdfBuffer = await buildOfficialActivityPDF({
    activity,
    report,
    attendanceRecords,
    verifiedMedia,
    completenessScore,
    department,
    coordinator,
    hod,
    director,
    approvals
  });

  // Calculate Next Version Number
  const existingDocs = await Document.find({
    activityId,
    documentType: 'GENERATED_ACTIVITY_REPORT'
  }).sort({ version: -1 });

  const nextVersion = existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;
  const fileName = `${reportId}-v${nextVersion}.pdf`;

  // Store PDF using Storage Abstraction Layer
  const fileObject = {
    originalname: fileName,
    buffer: pdfBuffer,
    mimetype: 'application/pdf',
    size: pdfBuffer.length
  };

  const { fileUrl } = await storageService.upload(fileObject, 'reports');

  // Register in Document Collection
  const docRecord = await Document.create({
    activityId,
    uploadedBy: user._id,
    departmentId: activity.departmentId?._id || activity.departmentId,
    documentType: 'GENERATED_ACTIVITY_REPORT',
    fileName,
    fileUrl,
    mimeType: 'application/pdf',
    fileSize: pdfBuffer.length,
    version: nextVersion,
    description: `Official Institutional Report ${reportId} (v${nextVersion})`,
    verificationStatus: 'VERIFIED',
    verifiedBy: user._id,
    verifiedAt: new Date()
  });

  if (req) {
    await logAudit({
      req,
      user,
      action: 'GENERATE_OFFICIAL_PDF',
      entity: 'Document',
      entityId: docRecord._id,
      details: `Generated Report ${reportId} v${nextVersion}`
    });
  }

  return {
    docRecord,
    reportId,
    version: nextVersion,
    fileUrl,
    pdfBuffer
  };
};
