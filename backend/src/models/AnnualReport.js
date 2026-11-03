import mongoose from 'mongoose';

const annualReportSchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      enum: ['DEPARTMENT', 'INSTITUTIONAL'],
      required: true,
      default: 'DEPARTMENT'
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
      // Optional for institutional consolidated report
    },
    academicYear: {
      type: String,
      required: true,
      trim: true
    },

    // Report Workflow Status
    status: {
      type: String,
      enum: ['DRAFT', 'HOD_VERIFIED', 'OFFICIAL_GENERATED', 'ARCHIVED'],
      default: 'DRAFT'
    },
    version: {
      type: Number,
      default: 1
    },

    // Authoritative Eligible Verified Activity IDs
    eligibleActivityIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity'
      }
    ],

    // Readiness Snapshot at time of generation/draft
    readinessSnapshot: {
      totalConducted: { type: Number, default: 0 },
      eligibleCount: { type: Number, default: 0 },
      pendingVerificationCount: { type: Number, default: 0 },
      missingReportsCount: { type: Number, default: 0 },
      excludedCount: { type: Number, default: 0 },
      readinessScore: { type: Number, default: 0 }
    },

    // Aggregated Statistics Snapshot
    statistics: {
      totalActivities: { type: Number, default: 0 },
      categoryBreakdown: { type: Map, of: Number, default: {} },
      totalAttendanceRecords: { type: Number, default: 0 },
      uniqueParticipantsCount: { type: Number, default: 0 },
      studentParticipantsCount: { type: Number, default: 0 },
      facultyParticipantsCount: { type: Number, default: 0 },
      externalParticipantsCount: { type: Number, default: 0 },
      monthlyBreakdown: { type: Map, of: Number, default: {} },
      totalEstimatedBudget: { type: Number, default: 0 },
      totalActualExpenditure: { type: Number, default: 0 },
      departmentWiseCounts: { type: Map, of: Number, default: {} }
    },

    // Extracted Document Traceability & Source References
    extractedDocumentData: [
      {
        activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
        fileName: { type: String, default: '' },
        documentType: { type: String, default: '' },
        extractedSummary: { type: String, default: '' },
        speakers: [{ type: String }],
        topics: [{ type: String }],
        outcomes: [{ type: String }],
        achievements: [{ type: String }],
        isTraceable: { type: Boolean, default: true },
        hasConflicts: { type: Boolean, default: false },
        conflictNotes: { type: String, default: '' }
      }
    ],

    // Editable & Reviewable Narrative Content (HOD can fine-tune narrative)
    narrativeContent: {
      executiveSummary: { type: String, default: '' },
      departmentOverview: { type: String, default: '' },
      facultyContributionsSummary: { type: String, default: '' },
      achievementsHighlights: { type: String, default: '' },
      annualConclusion: { type: String, default: '' },
      hodRemarks: { type: String, default: '' },
      directorRemarks: { type: String, default: '' }
    },

    // Structured Draft Content (Cached for preview & report generation)
    draftContent: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // Verification Metadata
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    verificationNotes: { type: String, default: '' },

    // Generation Metadata
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    generatedAt: { type: Date },

    // Official Generated PDF Storage
    pdfUrl: { type: String, default: '' },
    pdfFileName: { type: String, default: '' },
    pdfFileSize: { type: Number, default: 0 },

    // Version History (Preserving Previous Official Versions)
    versionHistory: [
      {
        version: { type: Number, required: true },
        pdfUrl: { type: String, required: true },
        pdfFileName: { type: String, required: true },
        pdfFileSize: { type: Number, default: 0 },
        generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        generatedAt: { type: Date, default: Date.now },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        verifiedAt: { type: Date },
        sourceActivitiesCount: { type: Number, default: 0 }
      }
    ],

    // Outdated Flag (if verified activity changes after report generation)
    isOutdated: { type: Boolean, default: false },
    outdatedReason: { type: String, default: '' }
  },
  { timestamps: true }
);

annualReportSchema.index({ departmentId: 1, academicYear: 1, reportType: 1 });
annualReportSchema.index({ academicYear: 1, reportType: 1 });
annualReportSchema.index({ status: 1 });

export default mongoose.model('AnnualReport', annualReportSchema);

