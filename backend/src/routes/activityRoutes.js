import express from 'express';
import {
  createActivity,
  getActivities,
  getActivityById,
  getPendingHodActivities,
  getForwardedHodActivities,
  reviewActivityByHod,
  forwardActivityToAdmin,
  getPendingAdminActivities,
  adminApproveActivity,
  adminRejectActivity,
  adminRequestChangesActivity,
  updateActivity,
  updateActivityBudget,
  updateActivityStatus,
  getActivityApprovals,
  getPublicActivityDetail
} from '../controllers/activityController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public endpoint for QR code scanner
router.get('/public/:id', getPublicActivityDetail);

router.use(protect);

// Queue & List Endpoints (Defined before parameterized :id routes)
router.get('/pending-hod', authorize('HOD', 'ADMIN'), getPendingHodActivities);
router.get('/forwarded-hod', authorize('HOD', 'ADMIN'), getForwardedHodActivities);
router.get('/pending-admin', authorize('ADMIN', 'DIRECTOR'), getPendingAdminActivities);

// General Activity CRUD & Queries
router.get('/', getActivities);
router.get('/:id', getActivityById);
router.get('/:id/approvals', getActivityApprovals);
router.post('/', createActivity);
router.put('/:id', updateActivity);
router.put('/:id/budget', updateActivityBudget);

// HOD Review & Forward Workflow
router.put('/:id/hod-review', authorize('HOD', 'ADMIN'), reviewActivityByHod);
router.patch('/:id/forward-to-admin', authorize('HOD', 'ADMIN'), forwardActivityToAdmin);

// Admin Final Approval & Decision Workflow
router.patch('/:id/admin-approve', authorize('ADMIN'), adminApproveActivity);
router.put('/:id/admin-review', authorize('ADMIN'), (req, res, next) => {
  if (req.body.action === 'APPROVE') return adminApproveActivity(req, res, next);
  if (req.body.action === 'REJECT') return adminRejectActivity(req, res, next);
  if (req.body.action === 'REQUEST_CHANGES') return adminRequestChangesActivity(req, res, next);
  return res.status(400).json({ success: false, message: 'Invalid admin-review action' });
});
router.patch('/:id/admin-reject', authorize('ADMIN'), adminRejectActivity);
router.patch('/:id/admin-request-changes', authorize('ADMIN'), adminRequestChangesActivity);

// Status Transition
router.put('/:id/status', updateActivityStatus);

export default router;
