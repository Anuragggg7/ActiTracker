import Activity from '../models/Activity.js';

export const checkForDuplicateActivity = async ({ title, departmentId, date, excludeId = null }) => {
  if (!title) return { isDuplicate: false };

  const query = {
    departmentId,
    // Exclude cancelled and rejected activities — their titles should be reusable
    status: { $nin: ['CANCELLED', 'REJECTED'] }
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

  // Use a case-insensitive regex to narrow the DB query instead of fetching all department activities
  const escapedTitle = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates = await Activity.find({
    ...query,
    title: { $regex: new RegExp(`^${escapedTitle}$`, 'i') }
  }).select('_id title status date').lean();

  for (const act of candidates) {
    const existingClean = act.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

    if (cleanTitle === existingClean) {
      return {
        isDuplicate: true,
        matchingActivity: {
          id: act._id,
          title: act.title,
          status: act.status,
          date: act.date
        },
        message: `An activity titled "${act.title}" already exists in your department.`
      };
    }
  }

  return { isDuplicate: false };
};
