import AuditLog from '../models/AuditLog.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { action, entity, userRole, search } = req.query;
    const query = {};

    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (userRole) query.userRole = userRole;

    if (search && search.trim()) {
      const s = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { userName: { $regex: s, $options: 'i' } },
        { action: { $regex: s, $options: 'i' } },
        { details: { $regex: s, $options: 'i' } }
      ];
    }

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
