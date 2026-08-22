import express from 'express';
import {
  getActivityReport,
  submitActivityReport,
  verifyActivityReport
} from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/activities/:id/report', getActivityReport);
router.post('/activities/:id/report', submitActivityReport);
router.put('/activities/:id/report/verify', authorize('HOD', 'ADMIN'), verifyActivityReport);

export default router;
