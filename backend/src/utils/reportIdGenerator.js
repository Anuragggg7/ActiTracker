import Activity from '../models/Activity.js';

/**
 * Generates or retrieves a unique institutional Report ID for an activity
 * Format: RCPIT-ACT-{YYYY}-{SEQUENCE} (e.g., RCPIT-ACT-2026-00001)
 * @param {Object} activity
 * @returns {Promise<String>}
 */
export const getOrGenerateReportId = async (activity) => {
  if (activity.reportId) {
    return activity.reportId;
  }

  const d = activity.date ? new Date(activity.date) : new Date();
  const year = d.getFullYear();

  // Find count of activities with reportId in current year to generate sequence
  const startOfYear = new Date(`${year}-01-01`);
  const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

  const countInYear = await Activity.countDocuments({
    date: { $gte: startOfYear, $lte: endOfYear },
    reportId: { $exists: true, $ne: '' }
  });

  const sequence = (countInYear + 1).toString().padStart(5, '0');
  const reportId = `RCPIT-ACT-${year}-${sequence}`;

  await Activity.findByIdAndUpdate(activity._id, { reportId });
  return reportId;
};
