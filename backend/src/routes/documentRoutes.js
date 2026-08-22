import express from 'express';
import {
  getActivityDocuments,
  uploadDocument,
  verifyDocument,
  deleteDocument
} from '../controllers/documentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadDocument as multerDoc } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/activities/:id/documents', getActivityDocuments);
router.post('/activities/:id/documents', multerDoc.single('file'), uploadDocument);
router.put('/documents/:docId/verify', authorize('HOD', 'ADMIN'), verifyDocument);
router.delete('/documents/:docId', deleteDocument);

export default router;
