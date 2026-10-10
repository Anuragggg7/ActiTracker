import mongoose from 'mongoose';

const activityApprovalSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    action: {
      type: String,
      enum: [
        'SUBMITTED',
        'HOD_REVIEW',
        'FORWARDED_TO_ADMIN',
        'ADMIN_REVIEW',
        'ADMIN_APPROVED',
        'ADMIN_REJECTED',
        'APPROVED',
        'REJECTED',
        'CHANGES_REQUESTED',
        'CHANGES_REQUIRED',
        'SLOT_REQUESTED',
        'SLOT_APPROVED',
        'SLOT_REJECTED',
        'SCHEDULED',
        'CONDUCTED',
        'REPORT_PENDING',
        'REPORT_SUBMITTED',
        'VERIFIED',
        'VERIFICATION',
        'COMPLETED',
        'ARCHIVED',
        'STATUS_UPDATE'
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
