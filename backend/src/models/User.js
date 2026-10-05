import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['FACULTY', 'HOD', 'TP', 'DIRECTOR', 'ADMIN'],
      required: true,
    },
    employeeId: { type: String, required: true, unique: true, trim: true, index: true },
    phone: { type: String, trim: true },
    altPhone: { type: String, trim: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other', ''] },
    dob: { type: Date },
    profilePhoto: { type: String, default: '/uploads/default-avatar.png' },
    
    // Professional Information
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    designation: { type: String, default: 'Assistant Professor' },
    specialization: { type: String, default: '' },
    qualification: { type: String, default: '' },
    joiningDate: { type: Date },
    experienceYears: { type: Number, default: 0 },
    employmentType: { type: String, enum: ['Permanent', 'Contract', 'Adjunct', 'Visiting'], default: 'Permanent' },
    
    // Verification documents
    verificationDocuments: [
      {
        docType: { type: String }, // e.g. Faculty ID, Appointment Letter
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],

    // Legacy / Permanent Alphanumeric Faculty Employee ID (Preserved for compatibility)
    facultyEmployeeId: { type: String, sparse: true, trim: true, uppercase: true },

    // Identity Card Metadata
    identityCard: {
      fileName: { type: String, default: '' },
      fileUrl: { type: String, default: '' },
      uploadedAt: { type: Date },
      verificationStatus: {
        type: String,
        enum: ['PENDING', 'VERIFIED', 'REJECTED'],
        default: 'PENDING'
      },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      verifiedAt: { type: Date },
      rejectionReason: { type: String, default: '' }
    },

    // Approval Email Delivery Status
    emailStatus: {
      type: String,
      enum: ['NOT_SENT', 'SENT', 'FAILED'],
      default: 'NOT_SENT'
    },

    // Account status for faculty & institutional users
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'APPROVED', 'SUSPENDED', 'PENDING', 'REJECTED'],
      default: 'ACTIVE'
    },
    rejectionReason: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    
    // System flag
    isSystemAdmin: { type: Boolean, default: false },

    // Single Active Session State
    activeSessionToken: { type: String, default: null },
    lastActiveAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

export default mongoose.model('User', userSchema);
