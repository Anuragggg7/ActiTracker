import express from 'express';
import {
  streamOfficialPDF,
  generateNewPdfVersion,
  getPdfVersions
} from '../controllers/pdfController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/activities/:id/report/pdf', streamOfficialPDF);
router.post('/activities/:id/report/pdf/generate', generateNewPdfVersion);
router.get('/activities/:id/report/pdf/versions', getPdfVersions);

export default router;
