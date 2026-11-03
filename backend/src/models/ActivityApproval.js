import mongoose from 'mongoose';

// Standard action types for activity approvals & lifecycle transitions
export const ACTIVITY_APPROVAL_ACTIONS = [
  'SUBMITTED',
  'PROPOSAL_SUBMITTED',
  'RESUBMITTED',
  'ACTIVITY_RESUBMITTED',
  'HOD_REVIEW',
  'HOD_FORWARDED',
  'HOD_REVIEW_FORWARD',
  'FORWARDED_TO_ADMIN',
  'ADMIN_REVIEW',
  'ADMIN_APPROVED',
  'ADMIN_REJECTED',
  'ADMIN_ACTIVITY_APPROVED',
  'ADMIN_ACTIVITY_REJECTED',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'CHANGES_REQUIRED',
  'HOD_REVIEW_REQUEST_CHANGES',
  'ADMIN_REQUEST_CHANGES',
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
  'STATUS_UPDATE',
  'CANCELLED',
  'SLOT_OFFERED',
  'SLOT_REALLOCATED',
  'PRIORITY_RECOMMENDED'
];

const activityApprovalSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    action: {
      type: String,
      required: true,
      trim: true
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

