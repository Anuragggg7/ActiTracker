import Activity from '../models/Activity.js';
import ActivityReport from '../models/ActivityReport.js';
import Attendance from '../models/Attendance.js';
import Media from '../models/Media.js';
import Document from '../models/Document.js';
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
    .populate('hodId')
    .populate('venueId');

  if (!activity) {
    throw new Error('Activity record not found');
  }

  const report = await ActivityReport.findOne({ activityId });
  
  // Verification Gate Check
  const isVerified = report?.status === 'VERIFIED' || ['COMPLETED', 'ARCHIVED'].includes(activity.status);
  if (!isVerified && user.role !== 'ADMIN') {
    throw new Error('Official PDF cannot be generated until the activity report is verified by HOD.');
  }

  const attendanceRecords = await Attendance.find({ activityId }).sort({ participantName: 1 });
  const verifiedMedia = await Media.find({ activityId, verificationStatus: 'VERIFIED' });
  const completenessScore = await calculateCompletenessScore(activityId);

  // Generate Report ID
  const reportId = await getOrGenerateReportId(activity);

  // Build PDF Buffer
  const pdfBuffer = await buildOfficialActivityPDF({
    activity,
    report,
    attendanceRecords,
    verifiedMedia,
    completenessScore
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
