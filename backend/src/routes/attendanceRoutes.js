import express from 'express';
import {
  getActivityAttendance,
  addParticipant,
  updateParticipant,
  removeParticipant,
  importAttendanceCSV,
  exportAttendanceCSV
} from '../controllers/attendanceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/activities/:id/attendance', getActivityAttendance);
router.post('/activities/:id/attendance', addParticipant);
router.post('/activities/:id/attendance/import', importAttendanceCSV);
router.get('/activities/:id/attendance/export', exportAttendanceCSV);
router.put('/attendance/:attendanceId', updateParticipant);
router.delete('/attendance/:attendanceId', removeParticipant);

export default router;
