import express from 'express';
import {
  getDirectorAnalytics,
  getDepartmentAnalytics,
  getAttendanceAnalytics,
  getVenueAnalytics,
  getTpAnalytics,
  exportAnalyticsCSV,
  getActionCenterItems
} from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/director', authorize('DIRECTOR', 'ADMIN'), getDirectorAnalytics);
router.get('/overview', getDirectorAnalytics);
router.get('/departments', getDepartmentAnalytics);
router.get('/attendance', getAttendanceAnalytics);
router.get('/venues', authorize('ADMIN', 'DIRECTOR'), getVenueAnalytics);
router.get('/tp', getTpAnalytics);
router.get('/export', exportAnalyticsCSV);
router.get('/action-center', getActionCenterItems);

export default router;
