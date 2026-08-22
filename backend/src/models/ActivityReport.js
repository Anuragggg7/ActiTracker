import mongoose from 'mongoose';

const activityReportSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, unique: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actualParticipants: { type: Number, required: true, default: 0 },
    keyHighlights: { type: String, default: '' },
    outcomes: { type: String, default: '' },
    achievements: { type: String, default: '' },
    feedback: { type: String, default: '' },
    conclusion: { type: String, default: '' },
    recommendations: { type: String, default: '' },
    reportFile: { type: String, default: '' }, // URL to uploaded PDF/Doc report
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'CHANGES_REQUIRED', 'VERIFIED', 'REJECTED'],
      default: 'DRAFT'
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('ActivityReport', activityReportSchema);
