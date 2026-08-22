import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    participantName: { type: String, required: true, trim: true },
    participantId: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: 'General' },
    participantType: {
      type: String,
      enum: ['STUDENT', 'FACULTY', 'EXTERNAL', 'GUEST'],
      default: 'STUDENT'
    },
    email: { type: String, trim: true, lowercase: true, default: '' },
    attendanceStatus: {
      type: String,
      enum: ['PRESENT', 'ABSENT'],
      default: 'PRESENT'
    },
    checkInTime: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model('Attendance', attendanceSchema);
