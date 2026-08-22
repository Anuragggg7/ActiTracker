import mongoose from 'mongoose';

const activityApprovalSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    action: {
      type: String,
      enum: [
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'CHANGES_REQUESTED',
        'SLOT_REQUESTED',
        'SLOT_APPROVED',
        'SLOT_REJECTED',
        'VERIFIED',
        'COMPLETED',
        'ARCHIVED'
      ],
      required: true
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
    previousStatus: { type: String, default: '' },
    newStatus: { type: String, default: '' },
    comments: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model('ActivityApproval', activityApprovalSchema);
