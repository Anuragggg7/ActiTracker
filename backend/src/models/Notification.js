import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'Approval' },
    category: {
      type: String,
      enum: ['Approval', 'Slot', 'Activity', 'Report', 'Media', 'System'],
      default: 'Approval'
    },
    relatedEntity: { type: String, default: 'User' },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    visibility: { type: String, enum: ['PUBLIC', 'PRIVATE'], default: 'PRIVATE' },
    dedupKey: { type: String, sparse: true, index: true },
    isRead: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    link: { type: String, default: '' }
  },
  { timestamps: true }
);

notificationSchema.pre('save', function (next) {
  if (this.isRead !== undefined) this.read = this.isRead;
  if (this.read !== undefined) this.isRead = this.read;
  if (this.category) this.type = this.category;
  next();
});

// Idempotent Notification Creation Safeguard (Requirement 18)
notificationSchema.statics.createIdempotent = async function (data) {
  const { recipientId, title, message, category, relatedEntityId, dedupKey } = data;

  const key = dedupKey || (relatedEntityId ? `${category}_${relatedEntityId}_${recipientId}` : null);

  if (key) {
    const existing = await this.findOne({
      $or: [
        { dedupKey: key },
        { recipientId, title, relatedEntityId, createdAt: { $gte: new Date(Date.now() - 60000) } }
      ]
    });
    if (existing) {
      console.log(`[Notification Deduplication] Skipped creation of duplicate notification: "${title}" for recipient ${recipientId}`);
      return existing;
    }
    data.dedupKey = key;
  }

  try {
    return await this.create(data);
  } catch (err) {
    if (err.code === 11000) {
      // Handle MongoDB E11000 duplicate key error gracefully
      return await this.findOne({ dedupKey: key });
    }
    throw err;
  }
};

export default mongoose.model('Notification', notificationSchema);
