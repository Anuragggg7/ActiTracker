import Attendance from '../models/Attendance.js';
import Activity from '../models/Activity.js';
import { calculateCompletenessScore } from '../utils/completenessCalculator.js';

// Helper to verify attendance modification access
const canModifyAttendance = (user, activity) => {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'DIRECTOR') return false;
  if (activity.isLocked) return false;

  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

  if (user.role === 'HOD') return userDeptId === actDeptId;
  if (user.role === 'FACULTY' || user.role === 'TP') {
    return activity.coordinatorId.toString() === user._id.toString() || userDeptId === actDeptId;
  }
  return false;
};

// Get Attendance List & Statistics
export const getActivityAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const records = await Attendance.find({ activityId: id }).sort({ participantName: 1 });

    const total = records.length;
    const present = records.filter(r => r.attendanceStatus === 'PRESENT').length;
    const absent = records.filter(r => r.attendanceStatus === 'ABSENT').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    res.json({
      success: true,
      stats: { total, present, absent, percentage },
      records
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add Single Participant
export const addParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    if (!canModifyAttendance(req.user, activity)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to modify attendance for this activity' });
    }

    const { participantName, participantId, department, participantType, email, attendanceStatus } = req.body;
    if (!participantName) {
      return res.status(400).json({ success: false, message: 'Participant name is required' });
    }

    const record = await Attendance.create({
      activityId: id,
      participantName,
      participantId: participantId || '',
      department: department || 'General',
      participantType: participantType || 'STUDENT',
      email: email || '',
      attendanceStatus: attendanceStatus || 'PRESENT',
      checkInTime: new Date()
    });

    await calculateCompletenessScore(id);
    res.status(201).json({ success: true, message: 'Participant added', record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Participant or Mark Status
export const updateParticipant = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const record = await Attendance.findById(attendanceId);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });

    const activity = await Activity.findById(record.activityId);
    if (!activity || !canModifyAttendance(req.user, activity)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update attendance' });
    }

    Object.assign(record, req.body);
    await record.save();
    await calculateCompletenessScore(record.activityId);

    res.json({ success: true, message: 'Participant updated', record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove Participant
export const removeParticipant = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const record = await Attendance.findById(attendanceId);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });

    const activity = await Activity.findById(record.activityId);
    if (!activity || !canModifyAttendance(req.user, activity)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to remove participant' });
    }

    await Attendance.findByIdAndDelete(attendanceId);
    await calculateCompletenessScore(record.activityId);

    res.json({ success: true, message: 'Participant removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Import Attendance CSV
export const importAttendanceCSV = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    if (!canModifyAttendance(req.user, activity)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to import attendance' });
    }

    const { csvText } = req.body;
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ success: false, message: 'CSV content string required' });
    }

    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.status(400).json({ success: false, message: 'CSV file must contain a header and at least 1 data row' });
    }

    const createdRecords = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      if (!parts[0]) continue;

      const record = await Attendance.create({
        activityId: id,
        participantName: parts[0],
        participantId: parts[1] || '',
        department: parts[2] || 'General',
        participantType: ['STUDENT', 'FACULTY', 'EXTERNAL', 'GUEST'].includes(parts[3]?.toUpperCase())
          ? parts[3].toUpperCase()
          : 'STUDENT',
        email: parts[4] || '',
        attendanceStatus: parts[5]?.toUpperCase() === 'ABSENT' ? 'ABSENT' : 'PRESENT'
      });
      createdRecords.push(record);
    }

    await calculateCompletenessScore(id);

    res.json({
      success: true,
      message: `Successfully imported ${createdRecords.length} attendance records`,
      count: createdRecords.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Export Attendance CSV
export const exportAttendanceCSV = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    const records = await Attendance.find({ activityId: id }).sort({ participantName: 1 });

    let csvContent = 'Participant Name,ID,Department,Type,Email,Status,CheckIn Time\n';
    records.forEach(r => {
      csvContent += `"${r.participantName}","${r.participantId}","${r.department}","${r.participantType}","${r.email}","${r.attendanceStatus}","${new Date(r.checkInTime).toLocaleString()}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Attendance_${activity?.title || id}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
