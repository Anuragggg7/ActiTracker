import Activity from '../models/Activity.js';
import Attendance from '../models/Attendance.js';
import Media from '../models/Media.js';
import ActivityReport from '../models/ActivityReport.js';
import SlotRequest from '../models/SlotRequest.js';

/**
 * Calculates Documentation Completeness Score (0-100%) from actual MongoDB records
 * @param {String} activityId
 * @returns {Promise<Number>} Score between 0 and 100
 */
export const calculateCompletenessScore = async (activityId) => {
  try {
    const activity = await Activity.findById(activityId);
    if (!activity) return 0;

    let score = 0;

    // 1. Mandatory Activity Details (Title, Date, Venue) - 20%
    if (activity.title && activity.date && (activity.venueId || activity.venueName)) {
      score += 20;
    }

    // 2. HOD Approval Status - 20%
    const validHodStatuses = ['HOD_APPROVED', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED', 'ARCHIVED'];
    if (validHodStatuses.includes(activity.status)) {
      score += 20;
    }

    // 3. Slot Approval Status - 15%
    const validSlotStatuses = ['SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED', 'ARCHIVED'];
    if (validSlotStatuses.includes(activity.status)) {
      score += 15;
    } else {
      const slotReq = await SlotRequest.findOne({ activityId, status: 'APPROVED' });
      if (slotReq) score += 15;
    }

    // 4. Attendance Records - 15%
    const attendanceCount = await Attendance.countDocuments({ activityId, attendanceStatus: 'PRESENT' });
    if (attendanceCount > 0) {
      score += 15;
    }

    // 5. Uploaded Images - 15%
    const imageCount = await Media.countDocuments({ activityId, mediaType: { $in: ['IMAGE', 'image'] } });
    if (imageCount > 0) {
      score += 15;
    }

    // 6. Verified Event Report - 15%
    const report = await ActivityReport.findOne({ activityId, status: 'VERIFIED' });
    if (report || activity.status === 'COMPLETED' || activity.status === 'ARCHIVED') {
      score += 15;
    }

    const finalScore = Math.min(100, score);
    await Activity.findByIdAndUpdate(activityId, { documentationScore: finalScore });

    return finalScore;
  } catch (err) {
    console.error('Failed to calculate completeness score:', err);
    return 0;
  }
};
