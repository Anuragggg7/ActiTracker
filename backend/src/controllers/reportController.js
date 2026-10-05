import ActivityReport from '../models/ActivityReport.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';
import { calculateCompletenessScore } from '../utils/completenessCalculator.js';
import { logAudit } from '../utils/auditLogger.js';

// Get Activity Report
export const getActivityReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await ActivityReport.findOne({ activityId: id })
      .populate('submittedBy', 'name email designation profilePhoto')
      .populate('reviewedBy', 'name email designation');

    if (!report) {
      return res.json({ success: true, report: null });
    }

    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Save Draft or Submit Report
export const submitActivityReport = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    const user = req.user;
    if (user.role === 'DIRECTOR') {
      return res.status(403).json({ success: false, message: 'Director has read-only access' });
    }

    // Ownership check
    const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
    const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();
    if (user.role === 'FACULTY' && activity.coordinatorId.toString() !== user._id.toString() && userDeptId !== actDeptId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to submit report for this activity' });
    }

    const {
      actualParticipants,
      keyHighlights,
      outcomes,
      achievements,
      feedback,
      conclusion,
      recommendations,
      reportFile,
      isDraft
    } = req.body;

    const reportStatus = isDraft ? 'DRAFT' : 'SUBMITTED';

    let report = await ActivityReport.findOne({ activityId: id });

    if (report) {
      if (report.status === 'VERIFIED') {
        return res.status(400).json({ success: false, message: 'Report is verified and locked from normal editing' });
      }

      report.actualParticipants = actualParticipants || report.actualParticipants;
      report.keyHighlights = keyHighlights || report.keyHighlights;
      report.outcomes = outcomes || report.outcomes;
      report.achievements = achievements || report.achievements;
      report.feedback = feedback || report.feedback;
      report.conclusion = conclusion || report.conclusion;
      report.recommendations = recommendations || report.recommendations;
      report.reportFile = reportFile || report.reportFile;
      report.status = reportStatus;
      await report.save();
    } else {
      report = await ActivityReport.create({
        activityId: id,
        submittedBy: user._id,
        actualParticipants: actualParticipants || activity.expectedParticipants || 0,
        keyHighlights: keyHighlights || '',
        outcomes: outcomes || '',
        achievements: achievements || '',
        feedback: feedback || '',
        conclusion: conclusion || '',
        recommendations: recommendations || '',
        reportFile: reportFile || '',
        status: reportStatus
      });
    }

    // Update Activity lifecycle status
    if (!isDraft) {
      activity.status = 'VERIFICATION';
      await activity.save();

      // Trigger HOD Notification
      await Notification.createIdempotent({
        recipientId: activity.hodId || activity.departmentId,
        recipientRole: 'HOD',
        title: `Post-Event Report Submitted: "${activity.title}"`,
        message: `${user.name} submitted the post-event report for "${activity.title}". HOD verification required.`,
        type: 'REPORT_SUBMITTED',
        link: `/activities/${id}`
      });
    } else {
      if (['CONDUCTED', 'SCHEDULED'].includes(activity.status)) {
        activity.status = 'REPORT_PENDING';
        await activity.save();
      }
    }

    await calculateCompletenessScore(id);
    await logAudit({ req, user, action: isDraft ? 'DRAFT_REPORT' : 'SUBMIT_REPORT', entity: 'ActivityReport', entityId: report._id, details: `Report status: ${reportStatus}` });

    res.status(201).json({
      success: true,
      message: isDraft ? 'Report draft saved successfully' : 'Report submitted for HOD verification',
      report
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// HOD Report Verification / Changes Required / Rejection
export const verifyActivityReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    const report = await ActivityReport.findOne({ activityId: id });
    if (!report) return res.status(404).json({ success: false, message: 'Activity report not found' });

    const user = req.user;
    if (!['HOD', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Only HOD or Admin can verify activity reports' });
    }

    // Department Isolation Check for HOD
    const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
    const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();
    if (user.role === 'HOD' && userDeptId !== actDeptId) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Cannot verify report of another department.' });
    }

    if (action === 'APPROVE' || action === 'VERIFY') {
      report.status = 'VERIFIED';
      report.reviewedBy = user._id;
      report.reviewedAt = new Date();
      await report.save();

      // Lifecycle Transition -> COMPLETED!
      activity.status = 'COMPLETED';
      activity.isLocked = true;
      await activity.save();

      await Notification.createIdempotent({
        recipientId: report.submittedBy,
        title: `Report Verified & Activity Completed: "${activity.title}"`,
        message: `Your post-event report for "${activity.title}" has been verified by HOD. The activity is now COMPLETED.`,
        type: 'REPORT_VERIFIED',
        link: `/activities/${id}`
      });
    } else if (action === 'REQUEST_CHANGES') {
      if (!notes) return res.status(400).json({ success: false, message: 'Notes are required when requesting changes' });
      report.status = 'CHANGES_REQUIRED';
      report.rejectionReason = notes;
      report.reviewedBy = user._id;
      report.reviewedAt = new Date();
      await report.save();

      activity.status = 'CHANGES_REQUIRED';
      await activity.save();

      await Notification.createIdempotent({
        recipientId: report.submittedBy,
        title: `Changes Requested on Report: "${activity.title}"`,
        message: `HOD requested changes on your report. Feedback: "${notes}"`,
        type: 'REPORT_CHANGES_REQUESTED',
        link: `/activities/${id}`
      });
    } else if (action === 'REJECT') {
      if (!notes) return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      report.status = 'REJECTED';
      report.rejectionReason = notes;
      report.reviewedBy = user._id;
      report.reviewedAt = new Date();
      await report.save();

      activity.status = 'REJECTED';
      await activity.save();

      await Notification.createIdempotent({
        recipientId: report.submittedBy,
        title: `Report Rejected: "${activity.title}"`,
        message: `Your post-event report for "${activity.title}" was rejected by HOD. Reason: "${notes}"`,
        type: 'REPORT_REJECTED',
        link: `/activities/${id}`
      });
    }

    await calculateCompletenessScore(id);
    await logAudit({ req, user, action: `VERIFY_REPORT_${action}`, entity: 'ActivityReport', entityId: report._id, details: `Report status set to ${report.status}` });

    res.json({
      success: true,
      message: `Report status updated to ${report.status}`,
      report,
      activityStatus: activity.status
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
