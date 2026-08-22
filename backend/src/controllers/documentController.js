import Document from '../models/Document.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';
import storageService from '../utils/storageService.js';
import { calculateCompletenessScore } from '../utils/completenessCalculator.js';
import { logAudit } from '../utils/auditLogger.js';

// Get all documents for an activity
export const getActivityDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const documents = await Document.find({ activityId: id })
      .populate('uploadedBy', 'name email designation profilePhoto')
      .populate('verifiedBy', 'name email designation')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: documents.length, documents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Document with Automatic Versioning
export const uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    const user = req.user;
    if (user.role === 'DIRECTOR') {
      return res.status(403).json({ success: false, message: 'Director has read-only access' });
    }

    const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
    const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

    if (user.role === 'FACULTY' && activity.coordinatorId.toString() !== user._id.toString() && userDeptId !== actDeptId) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload documents for this activity' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded' });
    }

    const { documentType, description } = req.body;
    if (!documentType) {
      return res.status(400).json({ success: false, message: 'Document type is required' });
    }

    // Versioning logic: find highest existing version for this documentType in this activity
    const existingDocs = await Document.find({ activityId: id, documentType }).sort({ version: -1 });
    const latestVersion = existingDocs.length > 0 ? existingDocs[0].version : 0;
    const newVersion = latestVersion + 1;

    const { fileUrl, fileName } = await storageService.upload(req.file, 'documents');

    const docItem = await Document.create({
      activityId: id,
      uploadedBy: user._id,
      departmentId: activity.departmentId,
      documentType,
      fileName,
      fileUrl,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      version: newVersion,
      description: description || `Version ${newVersion}`,
      verificationStatus: ['HOD', 'ADMIN'].includes(user.role) ? 'VERIFIED' : 'PENDING'
    });

    await calculateCompletenessScore(id);
    await logAudit({ req, user, action: 'UPLOAD_DOCUMENT', entity: 'Document', entityId: docItem._id, details: `Uploaded ${documentType} v${newVersion}` });

    res.status(201).json({
      success: true,
      message: `Document v${newVersion} uploaded successfully`,
      document: docItem
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Document (HOD / Admin)
export const verifyDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const { status } = req.body;

    const doc = await Document.findById(docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const user = req.user;
    if (!['HOD', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Only HOD or Admin can verify documents' });
    }

    const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
    const actDeptId = (doc.departmentId?._id || doc.departmentId)?.toString();
    if (user.role === 'HOD' && userDeptId !== actDeptId) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Cannot verify document of another department.' });
    }

    doc.verificationStatus = status;
    doc.verifiedBy = user._id;
    doc.verifiedAt = new Date();
    await doc.save();

    await calculateCompletenessScore(doc.activityId);

    res.json({ success: true, message: `Document successfully ${status.toLowerCase()}`, document: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Document
export const deleteDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const doc = await Document.findById(docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const user = req.user;
    const isUploader = doc.uploadedBy.toString() === user._id.toString();
    const isAdminOrHod = ['ADMIN', 'HOD'].includes(user.role);

    if (!isUploader && !isAdminOrHod) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
    }

    await storageService.delete(doc.fileUrl);
    await Document.findByIdAndDelete(docId);
    await calculateCompletenessScore(doc.activityId);

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
