import AuditLog from '../models/AuditLog.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { action, entity, userRole, search } = req.query;
    const query = {};

    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (userRole) query.userRole = userRole;

    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
