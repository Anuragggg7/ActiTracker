import express from 'express';
import { getDepartments, getDepartmentById, createDepartment, assignHod } from '../controllers/departmentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getDepartments);
router.get('/:id', getDepartmentById);
router.post('/', protect, authorize('ADMIN'), createDepartment);
router.put('/:departmentId/assign-hod', protect, authorize('ADMIN'), assignHod);

export default router;
