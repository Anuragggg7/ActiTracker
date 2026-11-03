import mongoose from 'mongoose';

const waitingQueueEntrySchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isAllDay: { type: Boolean, default: false },
    expectedParticipants: { type: Number, default: 50 },
    // Strict FCFS ordering based on reliable server-generated timestamp
    queueTimestamp: { type: Date, default: Date.now, required: true, index: true },
    status: {
      type: String,
      enum: ['WAITING', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
      default: 'WAITING',
      index: true
    },
    eligibilityStatus: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'INELIGIBLE'],
      default: 'APPROVED'
    },
    priority: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'NORMAL'],
      default: 'NORMAL'
    },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

waitingQueueEntrySchema.index({ venueId: 1, date: 1, status: 1 });
waitingQueueEntrySchema.index({ activityId: 1 });
waitingQueueEntrySchema.index({ requestedBy: 1 });

export default mongoose.model('WaitingQueueEntry', waitingQueueEntrySchema);

