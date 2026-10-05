import Activity from '../models/Activity.js';

export const checkForDuplicateActivity = async ({ title, departmentId, date, excludeId = null }) => {
  if (!title) return { isDuplicate: false };

  const query = {
    departmentId
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const departmentActivities = await Activity.find(query);

  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

  for (const act of departmentActivities) {
    const existingClean = act.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const isSameDate = date && new Date(act.date).toDateString() === new Date(date).toDateString();
    
    // Check exact title match or same title on same date
    if (cleanTitle === existingClean || (isSameDate && cleanTitle === existingClean)) {
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
