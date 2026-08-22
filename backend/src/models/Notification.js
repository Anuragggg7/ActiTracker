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

export default mongoose.model('Notification', notificationSchema);
