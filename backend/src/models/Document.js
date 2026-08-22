import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    documentType: {
      type: String,
      enum: [
        'PERMISSION_LETTER',
        'INVITATION',
        'ATTENDANCE',
        'CERTIFICATE',
        'EVENT_REPORT',
        'GENERATED_ACTIVITY_REPORT',
        'POSTER',
        'SUPPORTING_DOCUMENT',
        'OTHER'
      ],
      required: true
    },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
    description: { type: String, default: '' },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING'
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model('Document', documentSchema);
