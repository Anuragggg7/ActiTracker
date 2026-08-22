import Activity from '../models/Activity.js';
import Department from '../models/Department.js';
import Notification from '../models/Notification.js';
import SlotRequest from '../models/SlotRequest.js';
import Media from '../models/Media.js';
import Document from '../models/Document.js';
import ActivityReport from '../models/ActivityReport.js';
import { checkForDuplicateActivity } from '../utils/duplicateChecker.js';
import { calculateCompletenessScore } from '../utils/completenessCalculator.js';
import { logAudit } from '../utils/auditLogger.js';

// State Machine Transition Rules
const ALLOWED_TRANSITIONS = {
  'DRAFT': ['SUBMITTED'],
  'SUBMITTED': ['HOD_APPROVED', 'REJECTED', 'CHANGES_REQUIRED', 'DRAFT'],
  'CHANGES_REQUIRED': ['SUBMITTED', 'DRAFT'],
  'HOD_APPROVED': ['SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED'],
  'SLOT_REQUESTED': ['SLOT_APPROVED', 'REJECTED'],
  'SLOT_APPROVED': ['SCHEDULED', 'CONDUCTED'],
  'SCHEDULED': ['CONDUCTED', 'REPORT_PENDING'],
  'CONDUCTED': ['REPORT_PENDING', 'REPORT_SUBMITTED', 'VERIFICATION'],
  'REPORT_PENDING': ['REPORT_SUBMITTED', 'VERIFICATION'],
  'REPORT_SUBMITTED': ['VERIFICATION', 'COMPLETED', 'CHANGES_REQUIRED', 'REJECTED'],
  'VERIFICATION': ['COMPLETED', 'CHANGES_REQUIRED', 'REJECTED'],
  'COMPLETED': ['ARCHIVED'],
  'REJECTED': ['DRAFT']
};

// Create Activity
export const createActivity = async (req, res) => {
  try {
    const {
      title, category, departmentId, description, objectives,
      targetAudience, guestSpeaker, date, startTime, endTime, durationHours,
      venueId, venueName, expectedParticipants, studentParticipantsCount,
      facultyParticipantsCount, externalParticipantsCount, estimatedBudget, fundingSource,
      isDraft, ignoreDuplicateWarning
    } = req.body;

    const userDeptId = req.user.departmentId?._id || req.user.departmentId;
    const deptId = (req.user.role === 'FACULTY' || req.user.role === 'HOD') ? userDeptId : (departmentId || userDeptId);

    const department = await Department.findById(deptId).populate('hodId');
    if (!department) {
      return res.status(400).json({ success: false, message: 'Valid department is required' });
    }

    if (!ignoreDuplicateWarning) {
      const dupCheck = await checkForDuplicateActivity({ title, departmentId: deptId, date });
      if (dupCheck.isDuplicate) {
        return res.status(409).json({
          success: false,
          isDuplicate: true,
          matchingActivity: dupCheck.matchingActivity,
          message: dupCheck.message
        });
      }
    }

    const status = isDraft ? 'DRAFT' : 'SUBMITTED';

    const activity = await Activity.create({
      title,
      category,
      departmentId: deptId,
      description,
      objectives,
      coordinatorId: req.user._id,
      hodId: department.hodId?._id || department.hodId,
      targetAudience,
      guestSpeaker: guestSpeaker || {},
      date: new Date(date),
      startTime,
      endTime,
      durationHours: Number(durationHours) || 3,
      venueId: venueId || null,
      venueName: venueName || 'TBD',
      expectedParticipants: Number(expectedParticipants) || 50,
      studentParticipantsCount: Number(studentParticipantsCount) || 45,
      facultyParticipantsCount: Number(facultyParticipantsCount) || 5,
      externalParticipantsCount: Number(externalParticipantsCount) || 0,
      estimatedBudget: Number(estimatedBudget) || 0,
      fundingSource: fundingSource || 'Departmental Budget',
      status
    });

    await calculateCompletenessScore(activity._id);
    activity.qrCodeUrl = `/public/activity/${activity._id}`;
    await activity.save();

    if (status === 'SUBMITTED' && department.hodId) {
      await Notification.create({
        recipientId: department.hodId._id || department.hodId,
        senderId: req.user._id,
        title: 'New Activity Submitted for Approval',
        message: `${req.user.name} submitted activity "${title}" for ${department.name}.`,
        category: 'Activity',
        priority: 'HIGH',
        link: `/hod/activity-approvals`
      });
    }

    await logAudit({ req, user: req.user, action: isDraft ? 'DRAFT_ACTIVITY_CREATED' : 'ACTIVITY_SUBMITTED', entity: 'Activity', entityId: activity._id, departmentName: department.name, details: `Title: ${title}` });

    res.status(201).json({
      success: true,
      message: isDraft ? 'Activity saved as draft' : 'Activity submitted to HOD for review',
      activity
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Activities (Filtered by Role & Department Isolation)
export const getActivities = async (req, res) => {
  try {
    const { status, category, departmentId, search, isUpcoming, isCompleted } = req.query;
    const query = {};

    const userDeptId = req.user.departmentId?._id || req.user.departmentId;

    if (req.user.role === 'FACULTY') {
      query.$or = [
        { coordinatorId: req.user._id },
        { departmentId: userDeptId }
      ];
    } else if (req.user.role === 'HOD') {
      query.departmentId = userDeptId;
    } else if (req.user.role === 'TP') {
      query.$or = [
        { coordinatorId: req.user._id },
        { category: { $in: ['Placement Drive', 'Training', 'Industry Interaction', 'Industrial Visit'] } }
      ];
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (departmentId && ['ADMIN', 'DIRECTOR'].includes(req.user.role)) {
      query.departmentId = departmentId;
    }
    if (isUpcoming === 'true') {
      query.date = { $gte: new Date() };
    }
    if (isCompleted === 'true') {
      query.status = { $in: ['COMPLETED', 'ARCHIVED'] };
    }
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const activities = await Activity.find(query)
      .populate('departmentId', 'name code')
      .populate('coordinatorId', 'name email designation employeeId')
      .populate('venueId', 'name code location capacity')
      .sort({ date: -1 });

    res.json({ success: true, count: activities.length, activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Activity Details by ID (With Access Control)
export const getActivityById = async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate('departmentId', 'name code hodId')
      .populate('coordinatorId', 'name email designation phone profilePhoto employeeId')
      .populate('hodId', 'name email designation')
      .populate('venueId');

    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    // Department Isolation Check for HOD & Faculty
    const userDeptId = (req.user.departmentId?._id || req.user.departmentId)?.toString();
    const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

    if (req.user.role === 'HOD' && userDeptId !== actDeptId) {
      return res.status(403).json({ success: false, message: 'Access Denied: You can only view activities within your department.' });
    }

    const media = await Media.find({ activityId: activity._id }).populate('uploadedBy', 'name role');
    const documents = await Document.find({ activityId: activity._id }).populate('uploadedBy', 'name role');
    const slotRequest = await SlotRequest.findOne({ activityId: activity._id }).populate('venueId reviewedBy');
    const report = await ActivityReport.findOne({ activityId: activity._id }).populate('submittedBy reviewedBy');

    const score = await calculateCompletenessScore(activity._id);

    res.json({
      success: true,
      activity,
      media,
      documents,
      slotRequest,
      report,
      completeness: { score }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// HOD Review Activity Submission (Approve / Reject / Request Changes)
export const reviewActivityByHod = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    const activity = await Activity.findById(id).populate('coordinatorId departmentId');
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    const userDeptId = (req.user.departmentId?._id || req.user.departmentId)?.toString();
    const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

    if (req.user.role === 'HOD' && userDeptId !== actDeptId) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Cannot review activities of another department.' });
    }

    if (action === 'APPROVE') {
      activity.status = 'HOD_APPROVED';
      activity.hodReviewNotes = notes || 'Approved by HOD';

      await Notification.create({
        recipientId: activity.coordinatorId._id,
        senderId: req.user._id,
        title: 'Activity Approved by HOD',
        message: `Your activity "${activity.title}" was approved by HOD ${req.user.name}.`,
        category: 'Approval',
        priority: 'HIGH'
      });
    } else if (action === 'REJECT') {
      activity.status = 'REJECTED';
      activity.rejectionReason = notes || 'Not approved by HOD';

      await Notification.create({
        recipientId: activity.coordinatorId._id,
        senderId: req.user._id,
        title: 'Activity Rejected',
        message: `Your activity submission "${activity.title}" was rejected by HOD. Reason: ${notes}`,
        category: 'Approval',
        priority: 'HIGH'
      });
    } else if (action === 'REQUEST_CHANGES') {
      activity.status = 'CHANGES_REQUIRED';
      activity.hodReviewNotes = notes || 'Modifications requested by HOD';

      await Notification.create({
        recipientId: activity.coordinatorId._id,
        senderId: req.user._id,
        title: 'Activity Changes Requested',
        message: `HOD requested changes for "${activity.title}". Notes: ${notes}`,
        category: 'Approval',
        priority: 'HIGH'
      });
    }

    await activity.save();
    await logAudit({ req, user: req.user, action: `HOD_REVIEW_${action}`, entity: 'Activity', entityId: activity._id, details: `Notes: ${notes}` });

    res.json({ success: true, message: `Activity review completed: ${action}`, activity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Transition Event Status with State Machine & Role Security Validation
export const updateActivityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, notes } = req.body;

    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    // Lock check
    if (activity.isLocked && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Historical Record Locked: This activity is officially completed and locked against modifications. Contact Admin to request edits.'
      });
    }

    // Role-level status update security
    if (req.user.role === 'FACULTY' && ['HOD_APPROVED', 'VERIFIED', 'COMPLETED', 'ARCHIVED'].includes(newStatus)) {
      return res.status(403).json({ success: false, message: 'Faculty cannot directly set status to HOD_APPROVED, VERIFIED, or COMPLETED.' });
    }

    // Validate State Transition Machine
    const allowedNextStatuses = ALLOWED_TRANSITIONS[activity.status] || [];
    if (!allowedNextStatuses.includes(newStatus) && req.user.role !== 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${activity.status}' to '${newStatus}'. Allowed transitions: ${allowedNextStatuses.join(', ')}`
      });
    }

    activity.status = newStatus;
    if (['COMPLETED', 'ARCHIVED'].includes(newStatus)) {
      activity.isLocked = true;
    }

    await activity.save();
    await logAudit({ req, user: req.user, action: `ACTIVITY_STATUS_CHANGED_${newStatus}`, entity: 'Activity', entityId: activity._id, details: notes || `Status changed to ${newStatus}` });

    res.json({ success: true, message: `Activity status updated to ${newStatus}`, activity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Public Activity Details Endpoint (QR Verification)
export const getPublicActivityDetail = async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate('departmentId', 'name code')
      .populate('coordinatorId', 'name designation')
      .populate('venueId', 'name location');

    if (!activity) return res.status(404).json({ success: false, message: 'Invalid or expired activity record' });

    const media = await Media.find({ activityId: activity._id, mediaType: 'IMAGE' }).limit(4);
    const report = await ActivityReport.findOne({ activityId: activity._id });

    res.json({
      success: true,
      publicData: {
        title: activity.title,
        category: activity.category,
        department: activity.departmentId?.name,
        coordinator: activity.coordinatorId?.name,
        date: activity.date,
        time: `${activity.startTime} - ${activity.endTime}`,
        venue: activity.venueName || activity.venueId?.name,
        description: activity.description,
        objectives: activity.objectives,
        guestSpeaker: activity.guestSpeaker?.name,
        status: activity.status,
        actualParticipants: report?.actualParticipants || activity.expectedParticipants,
        images: media.map(m => m.fileUrl),
        verifiedInstitutionalRecord: true,
        institution: 'R. C. Patel Institute of Technology, Shirpur (RCPIT)'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
