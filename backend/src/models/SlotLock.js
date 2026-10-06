import mongoose from 'mongoose';

const slotLockSchema = new mongoose.Schema(
  {
    lockKey: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 30 }
  },
  { timestamps: true }
);

slotLockSchema.index({ lockKey: 1 }, { unique: true });

export default mongoose.model('SlotLock', slotLockSchema);
