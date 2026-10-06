import express from 'express';
import {
  createFaculty,
  updateFaculty,
  toggleUserStatus,
  resetFacultyPassword,
  getAllUsers,
  getFacultyById,
  createUserByAdmin,
  transferFacultyDepartment,
  getIdentityCardPhoto,
  getPendingFacultyRequests,
  reviewFacultyRegistration,
  approveFaculty,
  rejectFaculty,
  requestChangesFaculty,
  forceLogoutUser
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Dedicated Admin Faculty Management REST APIs
router.post('/faculty', protect, authorize('ADMIN'), createFaculty);
router.get('/faculty', protect, authorize('ADMIN', 'DIRECTOR', 'HOD'), getAllUsers);
router.get('/faculty/:id', protect, authorize('ADMIN', 'DIRECTOR', 'HOD'), getFacultyById);
router.put('/faculty/:id', protect, authorize('ADMIN'), updateFaculty);
router.patch('/faculty/:id/status', protect, authorize('ADMIN'), toggleUserStatus);
router.patch('/faculty/:id/password', protect, authorize('ADMIN'), resetFacultyPassword);
router.post('/faculty/:id/force-logout', protect, authorize('ADMIN'), forceLogoutUser);
router.post('/:userId/force-logout', protect, authorize('ADMIN'), forceLogoutUser);

// General User Management Routes
router.get('/', protect, authorize('ADMIN', 'DIRECTOR', 'HOD'), getAllUsers);
router.post('/admin-create', protect, authorize('ADMIN'), createUserByAdmin);
router.put('/:userId/toggle-status', protect, authorize('ADMIN'), toggleUserStatus);
router.put('/:facultyId/transfer', protect, authorize('ADMIN'), transferFacultyDepartment);

// Authenticated Profile Identity Card Retrieval
router.get('/identity-card/:userId', protect, getIdentityCardPhoto);

// Deprecated Registration Approval Endpoints (Maintained for safety & graceful degradation)
router.get('/hod/faculty-requests', protect, authorize('HOD', 'ADMIN'), getPendingFacultyRequests);
router.get('/faculty-requests', protect, authorize('HOD', 'ADMIN'), getPendingFacultyRequests);
router.get('/pending-faculty', protect, authorize('HOD', 'ADMIN'), getPendingFacultyRequests);
router.put('/hod/faculty/:id/approve', protect, authorize('HOD', 'ADMIN'), approveFaculty);
router.put('/faculty/:id/approve', protect, authorize('HOD', 'ADMIN'), approveFaculty);
router.put('/hod/faculty/:id/reject', protect, authorize('HOD', 'ADMIN'), rejectFaculty);
router.put('/faculty/:id/reject', protect, authorize('HOD', 'ADMIN'), rejectFaculty);
router.put('/hod/faculty/:id/request-changes', protect, authorize('HOD', 'ADMIN'), requestChangesFaculty);
router.put('/faculty/:id/request-changes', protect, authorize('HOD', 'ADMIN'), requestChangesFaculty);
router.post('/review-faculty/:facultyId', protect, authorize('HOD', 'ADMIN'), reviewFacultyRegistration);

export default router;
