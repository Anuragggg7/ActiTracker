import AuditLog from '../models/AuditLog.js';

export const logAudit = async ({ req, user, action, entity, entityId = '', departmentName = '', details = '', result = 'SUCCESS' }) => {
  try {
    const userId = user ? user._id || user.id : (req && req.user ? req.user._id : null);
    const userName = user ? user.name : (req && req.user ? req.user.name : 'System');
    const userRole = user ? user.role : (req && req.user ? req.user.role : 'SYSTEM');
    const ipAddress = req ? req.ip || req.connection?.remoteAddress || '127.0.0.1' : '127.0.0.1';

    await AuditLog.create({
      userId,
      userName,
      userRole,
      action,
      entity,
      entityId: String(entityId),
      departmentName,
      details,
      ipAddress,
      result
    });
  } catch (err) {
    console.error('[AuditLog Error]', err.message);
  }
};
