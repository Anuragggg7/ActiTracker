import Media from '../models/Media.js';
import Document from '../models/Document.js';
import ActivityReport from '../models/ActivityReport.js';

export const calculateDocumentationScore = async (activity) => {
  let score = 0;
  const checklist = [
    { label: 'Activity details completed', weight: 20, done: false },
    { label: 'Admin Approval & Slot Scheduled', weight: 20, done: false },
    { label: 'Attendance Uploaded', weight: 15, done: false },
    { label: 'Event Images Uploaded', weight: 15, done: false },
    { label: 'Event Video / Reel Uploaded', weight: 10, done: false },
    { label: 'Event Report Verified', weight: 15, done: false },
    { label: 'Certificates / Permission Letter', weight: 5, done: false }
  ];

  // 1. Details
  if (activity.title && activity.description && activity.objectives && activity.coordinatorId) {
    checklist[0].done = true;
    score += 20;
  }

  // 2. Approval & Slot
  if (['SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED', 'ARCHIVED'].includes(activity.status)) {
    checklist[1].done = true;
    score += 20;
  }

  // Check database items if activity._id exists
  if (activity._id) {
    const imagesCount = await Media.countDocuments({ activityId: activity._id, mediaType: 'image' });
    const videosCount = await Media.countDocuments({ activityId: activity._id, mediaType: 'video' });
    const attendanceCount = await Document.countDocuments({ activityId: activity._id, docType: 'Attendance' });
    const certCount = await Document.countDocuments({ activityId: activity._id, docType: { $in: ['Certificates', 'Permission Letter', 'Supporting Documents'] } });
    const report = await ActivityReport.findOne({ activityId: activity._id });

    if (attendanceCount > 0) {
      checklist[2].done = true;
      score += 15;
    }
    if (imagesCount > 0) {
      checklist[3].done = true;
      score += 15;
    }
    if (videosCount > 0) {
      checklist[4].done = true;
      score += 10;
    }
    if (report && ['SUBMITTED', 'VERIFIED'].includes(report.status)) {
      checklist[5].done = true;
      score += 15;
    }
    if (certCount > 0) {
      checklist[6].done = true;
      score += 5;
    }
  }

  return { score, checklist };
};
