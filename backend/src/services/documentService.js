import Document from '../models/Document.js';
import Activity from '../models/Activity.js';
import storageService from '../utils/storageService.js';
import { calculateCompletenessScore } from '../utils/completenessCalculator.js';
import { logAudit } from '../utils/auditLogger.js';

/**
 * Service: Get All Documents for an Activity
 */
export const getActivityDocumentsService = async ({ activityId, user }) => {
  const documents = await Document.find({ activityId })
    .populate('uploadedBy', 'name email designation profilePhoto role')
    .populate('verifiedBy', 'name email designation')
    .sort({ createdAt: -1 });

  return documents;
};

/**
 * Service: Upload Document with Automatic Versioning
 */
export const uploadDocumentService = async ({ activityId, file, documentType, description, user, req }) => {
  const activity = await Activity.findById(activityId);
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.role === 'DIRECTOR') {
    const error = new Error('Director has read-only access');
    error.statusCode = 403;
    throw error;
  }

  if (activity.isLocked && user.role !== 'ADMIN') {
    const error = new Error('Historical Record Locked: Cannot upload documents to locked activity');
    error.statusCode = 403;
    throw error;
  }

  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

  if (user.role === 'FACULTY' && activity.coordinatorId.toString() !== user._id.toString() && userDeptId !== actDeptId) {
    const error = new Error('Not authorized to upload documents for this activity');
    error.statusCode = 403;
    throw error;
  }

  if (user.role === 'HOD' && userDeptId !== actDeptId) {
    const error = new Error('Unauthorized: Cannot upload documents for another department');
    error.statusCode = 403;
    throw error;
  }

  if (!file) {
    const error = new Error('No document file uploaded');
    error.statusCode = 400;
    throw error;
  }

  if (!documentType) {
    const error = new Error('Document type is required');
    error.statusCode = 400;
    throw error;
  }

  // Versioning logic: find highest existing version for this documentType in this activity
  const existingDocs = await Document.find({ activityId, documentType }).sort({ version: -1 });
  const latestVersion = existingDocs.length > 0 ? existingDocs[0].version : 0;
  const newVersion = latestVersion + 1;

  const { fileUrl, fileName } = await storageService.upload(file, 'documents');

  const docItem = await Document.create({
    activityId,
    uploadedBy: user._id,
    departmentId: activity.departmentId,
    documentType,
    fileName,
    fileUrl,
    mimeType: file.mimetype,
    fileSize: file.size,
    version: newVersion,
    description: description || `Version ${newVersion}`,
    verificationStatus: ['HOD', 'ADMIN'].includes(user.role) ? 'VERIFIED' : 'PENDING'
  });

  await calculateCompletenessScore(activityId);

  await logAudit({
    req,
    user,
    action: 'UPLOAD_DOCUMENT',
    entity: 'Document',
    entityId: docItem._id,
    details: `Uploaded ${documentType} v${newVersion} (${fileName})`
  });

  return {
    docItem,
    newVersion
  };
};

/**
 * Service: Delete Document with Safety Checks & Storage Integrity (Change 2)
 */
export const deleteDocumentService = async ({ docId, user, req }) => {
  const doc = await Document.findById(docId);
  if (!doc) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  const activity = await Activity.findById(doc.activityId);

  // 1. Protection: Official Generated Reports cannot be accidentally deleted
  if (doc.documentType === 'GENERATED_ACTIVITY_REPORT') {
    const error = new Error('Protected Document: Generated official accreditation reports cannot be deleted.');
    error.statusCode = 403;
    throw error;
  }

  // 2. Protection: Locked Records cannot have documents deleted unless Admin
  if (activity?.isLocked && user.role !== 'ADMIN') {
    const error = new Error('Historical Record Locked: Cannot delete documents from a locked activity.');
    error.statusCode = 403;
    throw error;
  }

  // 3. Protection: Completed Activities cannot be modified by Faculty
  if (activity?.status === 'COMPLETED' && user.role === 'FACULTY') {
    const error = new Error('Completed activities are locked for audit integrity. Document cannot be deleted.');
    error.statusCode = 403;
    throw error;
  }

  // 4. Authorization Check
  const isUploader = doc.uploadedBy.toString() === user._id.toString();
  const isAdmin = user.role === 'ADMIN';
  const isDeptHod = user.role === 'HOD' && (user.departmentId?._id || user.departmentId)?.toString() === (doc.departmentId?._id || doc.departmentId)?.toString();

  if (!isUploader && !isAdmin && !isDeptHod) {
    const error = new Error('Not authorized to delete this document');
    error.statusCode = 403;
    throw error;
  }

  // 5. Storage Integrity: Avoid deleting physical file if shared with another document record
  const otherReferencesCount = await Document.countDocuments({
    fileUrl: doc.fileUrl,
    _id: { $ne: doc._id }
  });

  if (otherReferencesCount === 0) {
    await storageService.delete(doc.fileUrl);
  }

  // 6. Delete document record from MongoDB
  await Document.findByIdAndDelete(docId);
  await calculateCompletenessScore(doc.activityId);

  // 7. Audit Log
  await logAudit({
    req,
    user,
    action: 'DELETE_DOCUMENT',
    entity: 'Document',
    entityId: doc._id,
    details: `Deleted ${doc.documentType} v${doc.version} (${doc.fileName})`
  });

  return {
    success: true,
    message: 'Document deleted successfully',
    deletedDocId: docId
  };
};

/**
 * Service: Verify Document
 */
export const verifyDocumentService = async ({ docId, status, user, req }) => {
  const doc = await Document.findById(docId);
  if (!doc) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  if (!['HOD', 'ADMIN'].includes(user.role)) {
    const error = new Error('Only HOD or Admin can verify documents');
    error.statusCode = 403;
    throw error;
  }

  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (doc.departmentId?._id || doc.departmentId)?.toString();
  if (user.role === 'HOD' && userDeptId !== actDeptId) {
    const error = new Error('Unauthorized: Cannot verify document of another department.');
    error.statusCode = 403;
    throw error;
  }

  doc.verificationStatus = status;
  doc.verifiedBy = user._id;
  doc.verifiedAt = new Date();
  await doc.save();

  await calculateCompletenessScore(doc.activityId);

  await logAudit({
    req,
    user,
    action: 'VERIFY_DOCUMENT',
    entity: 'Document',
    entityId: doc._id,
    details: `Marked document as ${status}`
  });

  return doc;
};

