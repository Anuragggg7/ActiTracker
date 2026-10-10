import Activity from '../models/Activity.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import SlotRequest from '../models/SlotRequest.js';
import Media from '../models/Media.js';
import Document from '../models/Document.js';
import ActivityReport from '../models/ActivityReport.js';
import ActivityApproval from '../models/ActivityApproval.js';
import { checkForDuplicateActivity } from '../utils/duplicateChecker.js';
import { calculateCompletenessScore } from '../utils/completenessCalculator.js';
import { logAudit } from '../utils/auditLogger.js';
import { validateAndLockVenueBooking, SlotConflictError } from './slotService.js';

// State Machine Transition Rules
export const ALLOWED_TRANSITIONS = {
  'DRAFT': ['SUBMITTED'],
  'SUBMITTED': ['ADMIN_REVIEW', 'HOD_REVIEW', 'HOD_APPROVED', 'REJECTED', 'CHANGES_REQUIRED', 'DRAFT'],
  'HOD_REVIEW': ['ADMIN_REVIEW', 'REJECTED', 'CHANGES_REQUIRED', 'DRAFT'],
  'ADMIN_REVIEW': ['ADMIN_APPROVED', 'HOD_APPROVED', 'REJECTED', 'CHANGES_REQUIRED'],
  'ADMIN_APPROVED': ['SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED'],
  'HOD_APPROVED': ['ADMIN_REVIEW', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED'],
  'CHANGES_REQUIRED': ['SUBMITTED', 'DRAFT'],
  'SLOT_REQUESTED': ['SLOT_APPROVED', 'REJECTED', 'CHANGES_REQUIRED'],
  'SLOT_APPROVED': ['SCHEDULED', 'CONDUCTED'],
  'SCHEDULED': ['CONDUCTED', 'REPORT_PENDING'],
  'CONDUCTED': ['REPORT_PENDING', 'REPORT_SUBMITTED', 'VERIFICATION'],
  'REPORT_PENDING': ['REPORT_SUBMITTED', 'VERIFICATION'],
  'REPORT_SUBMITTED': ['VERIFICATION', 'COMPLETED', 'CHANGES_REQUIRED', 'REJECTED'],
  'VERIFICATION': ['COMPLETED', 'CHANGES_REQUIRED', 'REJECTED'],
  'COMPLETED': ['ARCHIVED'],
  'REJECTED': ['DRAFT']
};

/**
 * Service: Create Activity Proposal or Draft
 */
export const createActivityService = async ({ body, user, req }) => {
  const {
    title, category, departmentId, description, objectives,
    targetAudience, guestSpeaker, date, startTime, endTime, durationHours,
    venueId, venueName, expectedParticipants, studentParticipantsCount,
    facultyParticipantsCount, externalParticipantsCount, estimatedBudget, fundingSource,
    isDraft, ignoreDuplicateWarning
  } = body;

  const userDeptId = user.departmentId?._id || user.departmentId;
  const deptId = (user.role === 'FACULTY' || user.role === 'HOD') ? userDeptId : (departmentId || userDeptId);

  const department = await Department.findById(deptId).populate('hodId');
  if (!department) {
    const error = new Error('Valid department is required');
    error.statusCode = 400;
    throw error;
  }

  if (!ignoreDuplicateWarning) {
    const dupCheck = await checkForDuplicateActivity({ title, departmentId: deptId, date });
    if (dupCheck.isDuplicate) {
      const error = new Error(dupCheck.message);
      error.statusCode = 409;
      error.isDuplicate = true;
      error.matchingActivity = dupCheck.matchingActivity;
      throw error;
    }
  }

  if (venueId) {
    await validateAndLockVenueBooking({
      venueId,
      date,
      startTime,
      endTime,
      reqUser: user,
      req
    });
  }

  const status = isDraft ? 'DRAFT' : 'SUBMITTED';

  const activity = await Activity.create({
    title,
    category,
    departmentId: deptId,
    description,
    objectives,
    coordinatorId: user._id,
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

  if (status === 'SUBMITTED') {
    // Record creation in ActivityApproval
    await ActivityApproval.create({
      activityId: activity._id,
      action: 'SUBMITTED',
      performedBy: user._id,
      role: user.role,
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED',
      comments: 'Activity proposal submitted to HOD for review'
    });

    if (department.hodId) {
      await Notification.createIdempotent({
        recipientId: department.hodId._id || department.hodId,
        senderId: user._id,
        title: 'New Activity Submitted for HOD Review',
        message: `${user.name} submitted activity "${title}" for ${department.name}.`,
        category: 'Activity',
        priority: 'HIGH',
        link: `/hod`
      });
    }
  }

  await logAudit({
    req,
    user,
    action: isDraft ? 'DRAFT_ACTIVITY_CREATED' : 'ACTIVITY_SUBMITTED',
    entity: 'Activity',
    entityId: activity._id,
    departmentName: department.name,
    details: `Title: ${title}`
  });

  return activity;
};

/**
 * Service: Get Activities with Role-Based Isolation
 */
export const getActivitiesService = async ({ query, user }) => {
  const { status, category, departmentId, search, isUpcoming, isCompleted } = query;
  const filter = {};

  const userDeptId = user.departmentId?._id || user.departmentId;

  if (user.role === 'FACULTY') {
    filter.$or = [
      { coordinatorId: user._id },
      { departmentId: userDeptId }
    ];
  } else if (user.role === 'HOD') {
    filter.departmentId = userDeptId;
  } else if (user.role === 'TP') {
    filter.$or = [
      { coordinatorId: user._id },
      { category: { $in: ['Placement Drive', 'Training', 'Industry Interaction', 'Industrial Visit'] } }
    ];
  }

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (departmentId && ['ADMIN', 'DIRECTOR'].includes(user.role)) {
    filter.departmentId = departmentId;
  }
  if (isUpcoming === 'true') {
    filter.date = { $gte: new Date() };
  }
  if (isCompleted === 'true') {
    filter.status = { $in: ['COMPLETED', 'ARCHIVED'] };
  }
  if (search) {
    filter.title = { $regex: search, $options: 'i' };
  }

  const activities = await Activity.find(filter)
    .populate('departmentId', 'name code')
    .populate('coordinatorId', 'name email designation employeeId')
    .populate('hodId', 'name email designation')
    .populate('hodForwardedBy', 'name email designation')
    .populate('adminDecisionBy', 'name email designation')
    .populate('venueId', 'name code location capacity')
    .sort({ date: -1 });

  return activities;
};

/**
 * Service: Get Single Activity by ID
 */
export const getActivityByIdService = async ({ id, user }) => {
  const activity = await Activity.findById(id)
    .populate('departmentId', 'name code hodId')
    .populate('coordinatorId', 'name email designation phone profilePhoto employeeId')
    .populate('hodId', 'name email designation')
    .populate('hodForwardedBy', 'name email designation')
    .populate('adminDecisionBy', 'name email designation')
    .populate('venueId');

  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  // Department Isolation Check for HOD
  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

  if (user.role === 'HOD' && userDeptId !== actDeptId) {
    const error = new Error('Access Denied: You can only view activities within your department.');
    error.statusCode = 403;
    throw error;
  }

  const media = await Media.find({ activityId: activity._id }).populate('uploadedBy', 'name role');
  const documents = await Document.find({ activityId: activity._id }).populate('uploadedBy', 'name role');
  const slotRequest = await SlotRequest.findOne({ activityId: activity._id }).populate('venueId reviewedBy');
  const report = await ActivityReport.findOne({ activityId: activity._id }).populate('submittedBy reviewedBy');
  const approvals = await ActivityApproval.find({ activityId: activity._id }).populate('performedBy', 'name role email designation').sort({ createdAt: -1 });

  const score = await calculateCompletenessScore(activity._id);

  return {
    activity,
    media,
    documents,
    slotRequest,
    report,
    approvals,
    completeness: { score }
  };
};

/**
 * Service: Get Pending HOD Activities for Department
 */
export const getPendingHodActivitiesService = async ({ user }) => {
  const userDeptId = user.departmentId?._id || user.departmentId;
  const activities = await Activity.find({
    departmentId: userDeptId,
    status: { $in: ['SUBMITTED', 'HOD_REVIEW'] }
  })
    .populate('departmentId', 'name code')
    .populate('coordinatorId', 'name email designation employeeId')
    .populate('venueId', 'name code location capacity')
    .sort({ createdAt: -1 });

  return activities;
};

/**
 * Service: Get Forwarded Activities for HOD Dashboard
 */
export const getForwardedHodActivitiesService = async ({ user }) => {
  const userDeptId = user.departmentId?._id || user.departmentId;
  const activities = await Activity.find({
    departmentId: userDeptId,
    $or: [
      { hodForwardedBy: { $exists: true, $ne: null } },
      { status: { $in: ['ADMIN_REVIEW', 'ADMIN_APPROVED', 'HOD_APPROVED', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'COMPLETED'] } }
    ]
  })
    .populate('departmentId', 'name code')
    .populate('coordinatorId', 'name email designation employeeId')
    .populate('hodForwardedBy', 'name email designation')
    .populate('adminDecisionBy', 'name email designation')
    .populate('venueId', 'name code location capacity')
    .sort({ updatedAt: -1 });

  return activities;
};

/**
 * Service: HOD Review & Forward Activity
 * Actions:
 * - 'FORWARD' (or 'APPROVE' mapped to forward for backward compatibility): Forwards to Admin for final approval
 * - 'REQUEST_CHANGES': Requests modifications with mandatory notes
 * - 'REJECT': Rejects proposal with mandatory notes
 */
export const hodReviewActivityService = async ({ id, action, notes, user, req }) => {
  const activity = await Activity.findById(id).populate('coordinatorId departmentId');
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

  if (user.role === 'HOD' && userDeptId !== actDeptId) {
    const error = new Error('Unauthorized: Cannot review activities of another department.');
    error.statusCode = 403;
    throw error;
  }

  const previousStatus = activity.status;

  if (action === 'FORWARD' || (action === 'APPROVE' && user.role === 'HOD')) {
    activity.status = 'ADMIN_REVIEW';
    activity.hodReviewNotes = notes || 'Reviewed and forwarded by HOD to Admin for final approval';
    activity.hodForwardedAt = new Date();
    activity.hodForwardedBy = user._id;

    // Record ActivityApproval
    await ActivityApproval.create({
      activityId: activity._id,
      action: 'FORWARDED_TO_ADMIN',
      performedBy: user._id,
      role: user.role,
      previousStatus,
      newStatus: 'ADMIN_REVIEW',
      comments: notes || 'Reviewed and forwarded to Admin'
    });

    // Notify Admins
    const admins = await User.find({ role: 'ADMIN', status: { $in: ['APPROVED', 'ACTIVE'] } });
    for (const admin of admins) {
      await Notification.createIdempotent({
        recipientId: admin._id,
        senderId: user._id,
        title: 'Activity Proposal Forwarded for Approval',
        message: `${user.name} (HOD ${activity.departmentId?.code || ''}) forwarded activity "${activity.title}" for final approval.`,
        category: 'Approval',
        priority: 'HIGH',
        link: '/admin'
      });
    }

    // Notify Faculty Coordinator
    const coordRecipientId = activity.coordinatorId?._id || activity.coordinatorId;
    if (coordRecipientId) {
      await Notification.createIdempotent({
        recipientId: coordRecipientId,
        senderId: user._id,
        title: 'Activity Forwarded to Admin',
        message: `Your activity proposal "${activity.title}" was reviewed by HOD ${user.name} and forwarded to Admin for final approval.`,
        category: 'Approval',
        priority: 'MEDIUM',
        link: `/activities/${activity._id}`
      });
    }

    await activity.save();
    await logAudit({
      req,
      user,
      action: 'HOD_FORWARDED_TO_ADMIN',
      entity: 'Activity',
      entityId: activity._id,
      departmentName: activity.departmentId?.name,
      details: notes || 'Proposal forwarded to Admin for final institutional approval'
    });

    return {
      success: true,
      message: 'Activity proposal reviewed and forwarded to Admin for final approval',
      activity
    };
  } else if (action === 'REJECT') {
    if (!notes || !notes.trim()) {
      const error = new Error('Rejection requires a mandatory explanation notes/reason');
      error.statusCode = 400;
      throw error;
    }

    activity.status = 'REJECTED';
    activity.rejectionReason = notes;
    activity.hodReviewNotes = notes;

    await ActivityApproval.create({
      activityId: activity._id,
      action: 'REJECTED',
      performedBy: user._id,
      role: user.role,
      previousStatus,
      newStatus: 'REJECTED',
      comments: notes
    });

    const rejectCoordId = activity.coordinatorId?._id || activity.coordinatorId;
    if (rejectCoordId) {
      await Notification.createIdempotent({
        recipientId: rejectCoordId,
        senderId: user._id,
        title: 'Activity Proposal Rejected by HOD',
        message: `Your activity proposal "${activity.title}" was rejected by HOD. Reason: ${notes}`,
        category: 'Approval',
        priority: 'HIGH',
        link: `/activities/${activity._id}`
      });
    }

    await activity.save();
    await logAudit({
      req,
      user,
      action: 'HOD_REVIEW_REJECT',
      entity: 'Activity',
      entityId: activity._id,
      departmentName: activity.departmentId?.name,
      details: `Rejection reason: ${notes}`
    });

    return {
      success: true,
      message: 'Activity proposal rejected',
      activity
    };
  } else if (action === 'REQUEST_CHANGES') {
    if (!notes || !notes.trim()) {
      const error = new Error('Requesting changes requires specific feedback notes');
      error.statusCode = 400;
      throw error;
    }

    activity.status = 'CHANGES_REQUIRED';
    activity.hodReviewNotes = notes;

    await ActivityApproval.create({
      activityId: activity._id,
      action: 'CHANGES_REQUESTED',
      performedBy: user._id,
      role: user.role,
      previousStatus,
      newStatus: 'CHANGES_REQUIRED',
      comments: notes
    });

    const changeCoordId = activity.coordinatorId?._id || activity.coordinatorId;
    if (changeCoordId) {
      await Notification.createIdempotent({
        recipientId: changeCoordId,
        senderId: user._id,
        title: 'Activity Changes Requested by HOD',
        message: `HOD requested modifications for "${activity.title}". Notes: ${notes}`,
        category: 'Approval',
        priority: 'HIGH',
        link: `/activities/${activity._id}`
      });
    }

    await activity.save();
    await logAudit({
      req,
      user,
      action: 'HOD_REVIEW_REQUEST_CHANGES',
      entity: 'Activity',
      entityId: activity._id,
      departmentName: activity.departmentId?.name,
      details: `Changes requested: ${notes}`
    });

    return {
      success: true,
      message: 'Requested changes for activity proposal',
      activity
    };
  } else if (action === 'APPROVE' && user.role === 'ADMIN') {
    // If Admin calls review endpoint with action APPROVE, delegate to admin approval
    return await adminApproveActivityService({ id, notes, user, req });
  } else {
    const error = new Error(`Unsupported review action: ${action}`);
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Service: Get Pending Admin Activities (Activity Approval Center)
 */
export const getPendingAdminActivitiesService = async ({ user, query = {} }) => {
  if (!['ADMIN', 'DIRECTOR'].includes(user.role)) {
    const error = new Error('Access Denied: Only Admin can access pending admin approvals');
    error.statusCode = 403;
    throw error;
  }

  const { departmentId, category, search, status } = query;
  const filter = {
    status: status || 'ADMIN_REVIEW'
  };

  if (departmentId) filter.departmentId = departmentId;
  if (category) filter.category = category;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const activities = await Activity.find(filter)
    .populate('departmentId', 'name code')
    .populate('coordinatorId', 'name email designation employeeId')
    .populate('hodId', 'name email designation')
    .populate('hodForwardedBy', 'name email designation')
    .populate('adminDecisionBy', 'name email designation')
    .populate('venueId', 'name code location capacity')
    .sort({ hodForwardedAt: -1, createdAt: -1 });

  return activities;
};

/**
 * Service: Admin Final Approval of Activity Proposal
 */
export const adminApproveActivityService = async ({ id, notes, user, req }) => {
  if (user.role !== 'ADMIN') {
    const error = new Error('Forbidden: Only authorized System Administrator can approve activity proposals');
    error.statusCode = 403;
    throw error;
  }

  const activity = await Activity.findById(id).populate('coordinatorId departmentId hodId venueId');
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  // Validate state
  if (!['ADMIN_REVIEW', 'SUBMITTED', 'HOD_APPROVED'].includes(activity.status)) {
    const error = new Error(`Cannot approve activity in status '${activity.status}'. Activity must be in 'ADMIN_REVIEW' stage.`);
    error.statusCode = 400;
    throw error;
  }

  // Preserve FCFS venue and slot-conflict validation if venue is specified
  if (activity.venueId) {
    await validateAndLockVenueBooking({
      venueId: activity.venueId._id || activity.venueId,
      date: activity.date,
      startTime: activity.startTime,
      endTime: activity.endTime,
      excludeActivityId: activity._id,
      reqUser: user,
      req
    });
  }

  const previousStatus = activity.status;
  activity.status = 'ADMIN_APPROVED';
  activity.adminDecisionAt = new Date();
  activity.adminDecisionBy = user._id;
  activity.adminReviewNotes = notes || 'Officially approved by System Administrator';

  await ActivityApproval.create({
    activityId: activity._id,
    action: 'ADMIN_APPROVED',
    performedBy: user._id,
    role: 'ADMIN',
    previousStatus,
    newStatus: 'ADMIN_APPROVED',
    comments: notes || 'Proposal approved by Admin'
  });

  await calculateCompletenessScore(activity._id);
  await activity.save();

  // Notify Faculty Coordinator
  await Notification.createIdempotent({
    recipientId: activity.coordinatorId._id,
    senderId: user._id,
    title: 'Activity Approved by Admin!',
    message: `Congratulations! Your activity "${activity.title}" has received final institutional approval from Admin.`,
    category: 'Approval',
    priority: 'HIGH',
    link: `/activities/${activity._id}`
  });

  // Notify HOD
  const hodRecipientId = activity.hodId?._id || activity.hodForwardedBy;
  if (hodRecipientId) {
    await Notification.createIdempotent({
      recipientId: hodRecipientId,
      senderId: user._id,
      title: 'Department Activity Approved by Admin',
      message: `The activity proposal "${activity.title}" from your department has been approved by Admin.`,
      category: 'Approval',
      priority: 'MEDIUM',
      link: `/activities/${activity._id}`
    });
  }

  await logAudit({
    req,
    user,
    action: 'ADMIN_ACTIVITY_APPROVED',
    entity: 'Activity',
    entityId: activity._id,
    departmentName: activity.departmentId?.name,
    details: `Approved by Admin: ${notes || 'Final approval granted'}`
  });

  return {
    success: true,
    message: 'Activity proposal approved successfully by Admin',
    activity
  };
};

/**
 * Service: Admin Rejection of Activity Proposal
 */
export const adminRejectActivityService = async ({ id, reason, user, req }) => {
  if (user.role !== 'ADMIN') {
    const error = new Error('Forbidden: Only authorized System Administrator can reject activity proposals');
    error.statusCode = 403;
    throw error;
  }

  if (!reason || !reason.trim()) {
    const error = new Error('A meaningful rejection reason is mandatory');
    error.statusCode = 400;
    throw error;
  }

  const activity = await Activity.findById(id).populate('coordinatorId departmentId hodId');
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  const previousStatus = activity.status;
  activity.status = 'REJECTED';
  activity.rejectionReason = reason;
  activity.adminReviewNotes = reason;
  activity.adminDecisionAt = new Date();
  activity.adminDecisionBy = user._id;

  await ActivityApproval.create({
    activityId: activity._id,
    action: 'ADMIN_REJECTED',
    performedBy: user._id,
    role: 'ADMIN',
    previousStatus,
    newStatus: 'REJECTED',
    comments: reason
  });

  await activity.save();

  // Notify Faculty
  const adminRejectCoordId = activity.coordinatorId?._id || activity.coordinatorId;
  if (adminRejectCoordId) {
    await Notification.createIdempotent({
      recipientId: adminRejectCoordId,
      senderId: user._id,
      title: 'Activity Proposal Rejected by Admin',
      message: `Your activity proposal "${activity.title}" was rejected by Admin. Reason: ${reason}`,
      category: 'Approval',
      priority: 'HIGH',
      link: `/activities/${activity._id}`
    });
  }

  // Notify HOD
  const hodRecipientId = activity.hodId?._id || activity.hodForwardedBy;
  if (hodRecipientId) {
    await Notification.createIdempotent({
      recipientId: hodRecipientId,
      senderId: user._id,
      title: 'Department Activity Rejected by Admin',
      message: `The activity proposal "${activity.title}" was rejected by Admin. Reason: ${reason}`,
      category: 'Approval',
      priority: 'MEDIUM',
      link: `/activities/${activity._id}`
    });
  }

  await logAudit({
    req,
    user,
    action: 'ADMIN_ACTIVITY_REJECTED',
    entity: 'Activity',
    entityId: activity._id,
    departmentName: activity.departmentId?.name,
    details: `Rejection reason: ${reason}`
  });

  return {
    success: true,
    message: 'Activity proposal rejected by Admin',
    activity
  };
};

/**
 * Service: Admin Request Changes
 */
export const adminRequestChangesActivityService = async ({ id, notes, user, req }) => {
  if (user.role !== 'ADMIN') {
    const error = new Error('Forbidden: Only Admin can request changes at this stage');
    error.statusCode = 403;
    throw error;
  }

  if (!notes || !notes.trim()) {
    const error = new Error('Correction feedback notes are mandatory');
    error.statusCode = 400;
    throw error;
  }

  const activity = await Activity.findById(id).populate('coordinatorId departmentId hodId');
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  const previousStatus = activity.status;
  activity.status = 'CHANGES_REQUIRED';
  activity.adminReviewNotes = notes;
  activity.adminDecisionAt = new Date();
  activity.adminDecisionBy = user._id;

  await ActivityApproval.create({
    activityId: activity._id,
    action: 'CHANGES_REQUESTED',
    performedBy: user._id,
    role: 'ADMIN',
    previousStatus,
    newStatus: 'CHANGES_REQUIRED',
    comments: notes
  });

  await activity.save();

  // Notify Faculty
  const adminChangeCoordId = activity.coordinatorId?._id || activity.coordinatorId;
  if (adminChangeCoordId) {
    await Notification.createIdempotent({
      recipientId: adminChangeCoordId,
      senderId: user._id,
      title: 'Corrections Requested by Admin',
      message: `Admin requested changes for "${activity.title}". Notes: ${notes}`,
      category: 'Approval',
      priority: 'HIGH',
      link: `/activities/${activity._id}`
    });
  }

  // Notify HOD
  const hodRecipientId = activity.hodId?._id || activity.hodForwardedBy;
  if (hodRecipientId) {
    await Notification.createIdempotent({
      recipientId: hodRecipientId,
      senderId: user._id,
      title: 'Admin Requested Changes for Activity',
      message: `Admin requested changes for "${activity.title}". Notes: ${notes}`,
      category: 'Approval',
      priority: 'MEDIUM',
      link: `/activities/${activity._id}`
    });
  }

  await logAudit({
    req,
    user,
    action: 'ADMIN_REQUEST_CHANGES',
    entity: 'Activity',
    entityId: activity._id,
    departmentName: activity.departmentId?.name,
    details: `Requested changes: ${notes}`
  });

  return {
    success: true,
    message: 'Returned activity proposal for corrections',
    activity
  };
};

/**
 * Service: Update Activity Status with State Machine
 */
export const updateActivityStatusService = async ({ id, newStatus, notes, user, req }) => {
  const activity = await Activity.findById(id);
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  // Lock check
  if (activity.isLocked && user.role !== 'ADMIN') {
    const error = new Error('Historical Record Locked: This activity is officially completed and locked against modifications. Contact Admin to request edits.');
    error.statusCode = 403;
    throw error;
  }

  // Role-level status update security
  if (user.role === 'FACULTY' && ['ADMIN_REVIEW', 'ADMIN_APPROVED', 'HOD_APPROVED', 'VERIFIED', 'COMPLETED', 'ARCHIVED'].includes(newStatus)) {
    const error = new Error('Faculty cannot directly set status to ADMIN_REVIEW, ADMIN_APPROVED, HOD_APPROVED, VERIFIED, or COMPLETED.');
    error.statusCode = 403;
    throw error;
  }

  if (user.role === 'HOD' && ['ADMIN_APPROVED', 'COMPLETED', 'ARCHIVED'].includes(newStatus)) {
    const error = new Error('HOD cannot directly approve as Admin or complete activity.');
    error.statusCode = 403;
    throw error;
  }

  // Validate State Transition Machine
  const allowedNextStatuses = ALLOWED_TRANSITIONS[activity.status] || [];
  if (!allowedNextStatuses.includes(newStatus) && user.role !== 'ADMIN') {
    const error = new Error(`Invalid status transition from '${activity.status}' to '${newStatus}'. Allowed transitions: ${allowedNextStatuses.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const previousStatus = activity.status;
  activity.status = newStatus;
  if (['COMPLETED', 'ARCHIVED'].includes(newStatus)) {
    activity.isLocked = true;
  }

  await ActivityApproval.create({
    activityId: activity._id,
    action: newStatus,
    performedBy: user._id,
    role: user.role,
    previousStatus,
    newStatus,
    comments: notes || `Status changed to ${newStatus}`
  });

  await activity.save();
  await logAudit({
    req,
    user,
    action: `ACTIVITY_STATUS_CHANGED_${newStatus}`,
    entity: 'Activity',
    entityId: activity._id,
    details: notes || `Status changed to ${newStatus}`
  });

  return activity;
};

/**
 * Service: Update Activity Details
 */
export const updateActivityService = async ({ id, body, user, req }) => {
  const activity = await Activity.findById(id);
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  if (activity.isLocked && user.role !== 'ADMIN') {
    const error = new Error('Historical Record Locked: Cannot edit locked activity record.');
    error.statusCode = 403;
    throw error;
  }

  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

  if (user.role === 'FACULTY' && activity.coordinatorId.toString() !== user._id.toString()) {
    const error = new Error('Unauthorized to edit this activity.');
    error.statusCode = 403;
    throw error;
  }
  if (user.role === 'HOD' && userDeptId !== actDeptId) {
    const error = new Error('Unauthorized to edit activity of another department.');
    error.statusCode = 403;
    throw error;
  }

  const {
    title, category, description, objectives, targetAudience, guestSpeaker,
    date, startTime, endTime, durationHours, venueId, venueName,
    expectedParticipants, estimatedBudget, fundingSource
  } = body;

  const newVenueId = venueId !== undefined ? venueId : activity.venueId;
  const newDate = date ? new Date(date) : activity.date;
  const newStartTime = startTime || activity.startTime;
  const newEndTime = endTime || activity.endTime;

  if (newVenueId) {
    await validateAndLockVenueBooking({
      venueId: newVenueId,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      excludeActivityId: activity._id,
      reqUser: user,
      req
    });
  }

  if (title) activity.title = title;
  if (category) activity.category = category;
  if (description) activity.description = description;
  if (objectives !== undefined) activity.objectives = objectives;
  if (targetAudience) activity.targetAudience = targetAudience;
  if (guestSpeaker) activity.guestSpeaker = guestSpeaker;
  if (date) activity.date = newDate;
  if (startTime) activity.startTime = newStartTime;
  if (endTime) activity.endTime = newEndTime;
  if (durationHours) activity.durationHours = Number(durationHours);
  if (venueId !== undefined) activity.venueId = venueId;
  if (venueName !== undefined) activity.venueName = venueName;
  if (expectedParticipants !== undefined) activity.expectedParticipants = Number(expectedParticipants);
  if (estimatedBudget !== undefined) activity.estimatedBudget = Number(estimatedBudget);
  if (fundingSource) activity.fundingSource = fundingSource;

  await activity.save();
  await calculateCompletenessScore(activity._id);

  await logAudit({
    req,
    user,
    action: 'ACTIVITY_EDITED',
    entity: 'Activity',
    entityId: activity._id,
    details: `Title: ${activity.title}`
  });

  return activity;
};

/**
 * Service: Update Activity Budget
 */
export const updateActivityBudgetService = async ({ id, body, user, req }) => {
  const activity = await Activity.findById(id);
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

  if (user.role === 'HOD' && userDeptId !== actDeptId) {
    const error = new Error('Unauthorized to edit budget of another department.');
    error.statusCode = 403;
    throw error;
  }
  if (user.role === 'FACULTY' && activity.coordinatorId.toString() !== user._id.toString() && userDeptId !== actDeptId) {
    const error = new Error('Unauthorized to edit budget for this activity.');
    error.statusCode = 403;
    throw error;
  }

  const { estimatedBudget, approvedBudget, actualExpenditure, fundingSource, budgetStatus, budgetCategories } = body;

  if (estimatedBudget !== undefined) activity.estimatedBudget = Number(estimatedBudget);
  if (approvedBudget !== undefined && ['HOD', 'ADMIN', 'DIRECTOR'].includes(user.role)) {
    activity.approvedBudget = Number(approvedBudget);
  }
  if (actualExpenditure !== undefined) activity.actualExpenditure = Number(actualExpenditure);
  if (fundingSource) activity.fundingSource = fundingSource;
  if (budgetStatus && ['HOD', 'ADMIN', 'DIRECTOR'].includes(user.role)) {
    activity.budgetStatus = budgetStatus;
  }
  if (Array.isArray(budgetCategories)) {
    activity.budgetCategories = budgetCategories;
  }

  await activity.save();
  await logAudit({
    req,
    user,
    action: 'BUDGET_UPDATED',
    entity: 'Activity',
    entityId: activity._id,
    details: `Estimated: ₹${activity.estimatedBudget}, Approved: ₹${activity.approvedBudget}, Actual: ₹${activity.actualExpenditure}`
  });

  return activity;
};

/**
 * Service: Get Approval History for Activity
 */
export const getActivityApprovalsService = async ({ activityId }) => {
  const approvals = await ActivityApproval.find({ activityId })
    .populate('performedBy', 'name email role designation')
    .sort({ createdAt: 1 });

  return approvals;
};
