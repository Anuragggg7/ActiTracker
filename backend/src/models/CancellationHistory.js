import mongoose from 'mongoose';

const cancellationHistorySchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId },
    activityTitle: { type: String, required: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
    venueName: { type: String, default: 'TBD' },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isAllDay: { type: Boolean, default: false },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cancellerRole: { type: String, required: true },
    cancellerName: { type: String, default: '' },
    cancellationReason: { type: String, required: true, trim: true },
    cancelledAt: { type: Date, default: Date.now },
    reallocationStatus: {
      type: String,
      enum: ['NO_ELIGIBLE_REQUEST', 'OFFERED', 'REALLOCATED', 'EXPIRED'],
      default: 'NO_ELIGIBLE_REQUEST'
    },
    reallocatedToActivityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
    reallocatedOfferId: { type: mongoose.Schema.Types.ObjectId, ref: 'SlotOffer' }
  },
  { timestamps: true }
);

cancellationHistorySchema.index({ activityId: 1 });
cancellationHistorySchema.index({ venueId: 1, date: 1 });
cancellationHistorySchema.index({ cancelledAt: -1 });

export default mongoose.model('CancellationHistory', cancellationHistorySchema);

