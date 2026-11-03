import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        'Workshop',
        'Seminar',
        'FDP',
        'Guest Lecture',
        'Hackathon',
        'Competition',
        'Industrial Visit',
        'Training',
        'Placement Drive',
        'Cultural Event',
        'Sports Event',
        'Project Exhibition',
        'Alumni Meet',
        'Conference',
        'Awareness Program',
        'Industry Interaction',
        'Examination Activity',
        'Meeting',
        'Other'
      ],
      required: true
    },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    description: { type: String, required: true },
    objectives: { type: String, default: '' },
    
    // Coordinators & Authorities
    coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coCoordinators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    hodId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Audience & Speakers
    targetAudience: { type: String, default: 'Students & Faculty' },
    guestSpeaker: {
      name: { type: String, default: '' },
      designation: { type: String, default: '' },
      organization: { type: String, default: '' },
      contact: { type: String, default: '' }
    },

    // Schedule details (Primary / First occurrence for backward compatibility)
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // e.g. "10:00"
    endTime: { type: String, required: true }, // e.g. "13:00"
    durationHours: { type: Number, default: 3 },
    isAllDay: { type: Boolean, default: false },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
    venueName: { type: String, default: 'TBD' },

    // Multiple sessions / time slots support (Enhancement B)
    sessions: [
      {
        sessionTitle: { type: String, default: '' },
        date: { type: Date, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        durationHours: { type: Number, default: 3 },
        isAllDay: { type: Boolean, default: false },
        venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
        venueName: { type: String, default: 'TBD' },
        expectedParticipants: { type: Number, default: 50 },
        status: {
          type: String,
          enum: ['SCHEDULED', 'CONDUCTED', 'CANCELLED'],
          default: 'SCHEDULED'
        },
        cancelledAt: { type: Date },
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        cancellationReason: { type: String, default: '' }
      }
    ],

    // Participants count estimate
    expectedParticipants: { type: Number, default: 50 },
    studentParticipantsCount: { type: Number, default: 45 },
    facultyParticipantsCount: { type: Number, default: 5 },
    externalParticipantsCount: { type: Number, default: 0 },

    // Financial & Detailed Budget
    estimatedBudget: { type: Number, default: 0 },
    approvedBudget: { type: Number, default: 0 },
    actualExpenditure: { type: Number, default: 0 },
    fundingSource: { type: String, default: 'Departmental Budget' },
    budgetStatus: {
      type: String,
      enum: ['PROPOSED', 'APPROVED', 'REVISED', 'REJECTED'],
      default: 'PROPOSED'
    },
    budgetCategories: [
      {
        categoryName: { type: String, required: true }, // e.g. Guest Honorarium, Refreshments, Printing, Travel
        estimatedAmount: { type: Number, default: 0 },
        actualAmount: { type: Number, default: 0 },
        notes: { type: String, default: '' }
      }
    ],

    // Lifecycle Status
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'HOD_REVIEW',
        'ADMIN_REVIEW',
        'ADMIN_APPROVED',
        'HOD_APPROVED',
        'SLOT_REQUESTED',
        'SLOT_APPROVED',
        'SCHEDULED',
        'CONDUCTED',
        'REPORT_PENDING',
        'REPORT_SUBMITTED',
        'VERIFICATION',
        'COMPLETED',
        'ARCHIVED',
        'REJECTED',
        'CHANGES_REQUIRED',
        'CANCELLED'
      ],
      default: 'DRAFT'
    },

    // Review, Forwarding & Approval feedback
    hodReviewNotes: { type: String, default: '' },
    hodForwardedAt: { type: Date },
    hodForwardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminReviewNotes: { type: String, default: '' },
    adminDecisionAt: { type: Date },
    adminDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminSlotNotes: { type: String, default: '' },

    // HOD Priority Recommendation (Enhancement E)
    hodPriority: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'NORMAL'],
      default: 'NORMAL'
    },
    hodPriorityReason: { type: String, default: '' },
    hodPriorityAssignedAt: { type: Date },
    hodPriorityAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Mandatory Rejection Details & History (Enhancement F)
    rejectionReason: { type: String, default: '' },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectedRole: { type: String, default: '' },
    rejectionHistory: [
      {
        reason: { type: String, required: true },
        rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, default: '' },
        rejectedAt: { type: Date, default: Date.now }
      }
    ],

    // Cancellation Details (Enhancement C)
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, default: '' },

    // Completeness Score & Lock Status
    reportId: { type: String, default: '' },
    documentationScore: { type: Number, default: 30 }, // 0 to 100%
    isLocked: { type: Boolean, default: false },
    qrCodeUrl: { type: String, default: '' },

    // Historical Edit Audit Log Flag
    editRequests: [
      {
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String },
        status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
        requestedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

activitySchema.index({ departmentId: 1, status: 1 });
activitySchema.index({ venueId: 1, date: 1, status: 1 });
activitySchema.index({ coordinatorId: 1 });
activitySchema.index({ 'sessions.venueId': 1, 'sessions.date': 1, status: 1 });
activitySchema.index({ hodPriority: 1 });

export default mongoose.model('Activity', activitySchema);
