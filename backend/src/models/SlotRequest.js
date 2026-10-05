import mongoose from 'mongoose';

const slotRequestSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    requestedDate: { type: Date, required: true },
    date: { type: Date },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CONFLICT', 'CONFLICT_DETECTED', 'ALTERNATIVE_SUGGESTED', 'CANCELLED'],
      default: 'PENDING'
    },

    rejectionReason: { type: String, default: '' },

    conflictDetails: {
      hasConflict: { type: Boolean, default: false },
      conflictingActivityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
      conflictMessage: { type: String, default: '' }
    },

    suggestedAlternatives: [
      {
        venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
        venueName: { type: String },
        date: { type: Date },
        startTime: { type: String },
        endTime: { type: String }
      }
    ],

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNotes: { type: String, default: '' },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

slotRequestSchema.index({ venueId: 1, requestedDate: 1, status: 1 });
slotRequestSchema.index({ activityId: 1 });

slotRequestSchema.pre('save', function (next) {
  if (this.requestedDate && !this.date) this.date = this.requestedDate;
  if (this.date && !this.requestedDate) this.requestedDate = this.date;
  if (this.adminNotes && !this.rejectionReason) this.rejectionReason = this.adminNotes;
  if (this.rejectionReason && !this.adminNotes) this.adminNotes = this.rejectionReason;
  next();
});

export default mongoose.model('SlotRequest', slotRequestSchema);
