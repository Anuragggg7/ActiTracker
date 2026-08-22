import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    hodId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model('Department', departmentSchema);
