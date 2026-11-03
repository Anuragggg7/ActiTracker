import {
  getActivityDocumentsService,
  uploadDocumentService,
  deleteDocumentService,
  verifyDocumentService
} from '../services/documentService.js';

// Get all documents for an activity
export const getActivityDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const documents = await getActivityDocumentsService({ activityId: id, user: req.user });
    res.json({ success: true, count: documents.length, documents });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Upload Document with Automatic Versioning
export const uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType, description } = req.body;

    const { docItem, newVersion } = await uploadDocumentService({
      activityId: id,
      file: req.file,
      documentType,
      description,
      user: req.user,
      req
    });

    res.status(201).json({
      success: true,
      message: `Document v${newVersion} uploaded successfully`,
      document: docItem
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Verify Document (HOD / Admin)
export const verifyDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const { status } = req.body;

    const document = await verifyDocumentService({
      docId,
      status,
      user: req.user,
      req
    });

    res.json({ success: true, message: `Document successfully ${status.toLowerCase()}`, document });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Delete Document (Change 2)
export const deleteDocument = async (req, res) => {
  try {
    const { docId } = req.params;

    const result = await deleteDocumentService({
      docId,
      user: req.user,
      req
    });

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
