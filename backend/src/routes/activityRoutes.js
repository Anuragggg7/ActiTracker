import express from 'express';
import {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  updateActivityBudget,
  reviewActivityByHod,
  updateActivityStatus,
  getPublicActivityDetail
} from '../controllers/activityController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public endpoint for QR code scanner
router.get('/public/:id', getPublicActivityDetail);

router.use(protect);

router.get('/', getActivities);
router.get('/:id', getActivityById);
router.post('/', createActivity);
router.put('/:id', updateActivity);
router.put('/:id/budget', updateActivityBudget);
router.put('/:id/hod-review', authorize('HOD', 'ADMIN'), reviewActivityByHod);
router.put('/:id/status', updateActivityStatus);

export default router;
