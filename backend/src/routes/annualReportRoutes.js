import express from 'express';
import {
  getAcademicYears,
  getReportReadiness,
  getAnnualReport,
  generateDepartmentDraft,
  updateReportNarrative,
  verifyReportDraft,
  generateOfficialPDF,
  getAdminOverview,
  generateConsolidatedDraft
} from '../controllers/annualReportController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// 1. General & Department HOD Endpoints
router.get('/academic-years', getAcademicYears);
router.get('/readiness', authorize('HOD', 'ADMIN', 'DIRECTOR'), getReportReadiness);
router.post('/department/draft', authorize('HOD', 'ADMIN'), generateDepartmentDraft);
router.get('/:id', authorize('HOD', 'ADMIN', 'DIRECTOR'), getAnnualReport);
router.patch('/:id/narrative', authorize('HOD', 'ADMIN'), updateReportNarrative);
router.patch('/:id/verify', authorize('HOD', 'ADMIN'), verifyReportDraft);
router.post('/:id/generate-pdf', authorize('HOD', 'ADMIN'), generateOfficialPDF);

// 2. Admin Centralized & Institutional Endpoints
router.get('/admin/overview', authorize('ADMIN', 'DIRECTOR'), getAdminOverview);
router.post('/admin/consolidated/draft', authorize('ADMIN'), generateConsolidatedDraft);

export default router;

