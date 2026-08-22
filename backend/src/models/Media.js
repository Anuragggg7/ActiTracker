import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    mediaType: { type: String, enum: ['IMAGE', 'VIDEO', 'image', 'video'], required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    caption: { type: String, default: '' },
    description: { type: String, default: '' },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING'
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('Media', mediaSchema);
