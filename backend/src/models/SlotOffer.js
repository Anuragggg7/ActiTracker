import mongoose from 'mongoose';

const slotOfferSchema = new mongoose.Schema(
  {
    waitingQueueId: { type: mongoose.Schema.Types.ObjectId, ref: 'WaitingQueueEntry', required: true },
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isAllDay: { type: Boolean, default: false },
    offeredToUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    offeredAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
      default: 'OFFERED',
      index: true
    },
    respondedAt: { type: Date },
    responseNotes: { type: String, default: '' }
  },
  { timestamps: true }
);

slotOfferSchema.index({ offeredToUser: 1, status: 1 });
slotOfferSchema.index({ venueId: 1, date: 1, status: 1 });
slotOfferSchema.index({ expiresAt: 1, status: 1 });

export default mongoose.model('SlotOffer', slotOfferSchema);

