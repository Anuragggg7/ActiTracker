import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId },
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

attendanceSchema.index({ activityId: 1, sessionId: 1 });

export default mongoose.model('Attendance', attendanceSchema);
