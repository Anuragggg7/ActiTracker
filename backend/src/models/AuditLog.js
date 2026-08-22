import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: 'System' },
    userRole: { type: String, default: 'SYSTEM' },
    action: { type: String, required: true }, // e.g. "USER_LOGIN", "FACULTY_APPROVED", "ACTIVITY_CREATED", "SLOT_APPROVED", etc.
    entity: { type: String, required: true }, // e.g. "Activity", "User", "SlotRequest"
    entityId: { type: String, default: '' },
    departmentName: { type: String, default: '' },
    details: { type: String, default: '' },
    ipAddress: { type: String, default: '127.0.0.1' },
    result: { type: String, enum: ['SUCCESS', 'FAILURE', 'WARNING'], default: 'SUCCESS' }
  },
  { timestamps: true }
);

export default mongoose.model('AuditLog', auditLogSchema);
