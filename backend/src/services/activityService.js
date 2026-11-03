import Activity from '../models/Activity.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import SlotRequest from '../models/SlotRequest.js';
import SlotOffer from '../models/SlotOffer.js';
import WaitingQueueEntry from '../models/WaitingQueueEntry.js';
import Media from '../models/Media.js';
import Document from '../models/Document.js';
import ActivityReport from '../models/ActivityReport.js';
import ActivityApproval from '../models/ActivityApproval.js';
import CancellationHistory from '../models/CancellationHistory.js';
import { checkForDuplicateActivity } from '../utils/duplicateChecker.js';
import { calculateCompletenessScore } from '../utils/completenessCalculator.js';
import { logAudit } from '../utils/auditLogger.js';
import {
  validateAndLockVenueBooking,
  validateVenueCapacity,
  validateTimeRange,
  validateSessionsScheduleAndCapacity,
  processSlotReallocation,
  toDateString,
  SlotConflictError
} from './slotService.js';

// State Machine Transition Rules
export const ALLOWED_TRANSITIONS = {
  'DRAFT': ['SUBMITTED', 'CANCELLED'],
  'SUBMITTED': ['ADMIN_REVIEW', 'HOD_REVIEW', 'HOD_APPROVED', 'REJECTED', 'CHANGES_REQUIRED', 'DRAFT', 'CANCELLED'],
  'HOD_REVIEW': ['ADMIN_REVIEW', 'REJECTED', 'CHANGES_REQUIRED', 'DRAFT', 'CANCELLED'],
  'ADMIN_REVIEW': ['ADMIN_APPROVED', 'HOD_APPROVED', 'REJECTED', 'CHANGES_REQUIRED', 'CANCELLED'],
  'ADMIN_APPROVED': ['SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'CANCELLED'],
  'HOD_APPROVED': ['ADMIN_REVIEW', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CANCELLED'],
  'CHANGES_REQUIRED': ['SUBMITTED', 'ADMIN_REVIEW', 'DRAFT', 'CANCELLED'],
  'SLOT_REQUESTED': ['SLOT_APPROVED', 'REJECTED', 'CHANGES_REQUIRED', 'CANCELLED'],
  'SLOT_APPROVED': ['SCHEDULED', 'CONDUCTED', 'CANCELLED'],
  'SCHEDULED': ['CONDUCTED', 'REPORT_PENDING', 'CANCELLED'],
  'CONDUCTED': ['REPORT_PENDING', 'REPORT_SUBMITTED', 'VERIFICATION'],
  'REPORT_PENDING': ['REPORT_SUBMITTED', 'VERIFICATION'],
  'REPORT_SUBMITTED': ['VERIFICATION', 'COMPLETED', 'CHANGES_REQUIRED', 'REJECTED'],
  'VERIFICATION': ['COMPLETED', 'CHANGES_REQUIRED', 'REJECTED'],
  'COMPLETED': ['ARCHIVED'],
  'REJECTED': ['DRAFT'],
  'CANCELLED': []
};

// Enhancement G: Word Count Helper
export const countWords = (text) => {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

export const validateDescriptionWordCount = (description) => {
  if (!description || typeof description !== 'string') return 0;
  const words = countWords(description);
  if (words > 300) {
    const error = new Error(`Activity description exceeds the 300-word limit (${words} words provided). Please shorten the description to 300 words or less.`);
    error.statusCode = 400;
    throw error;
  }
  return words;
};

/**
 * Service: Create Activity with Enhanced Scheduling, Word Limit & Capacity Checks
 */
export const createActivityService = async (data, userId) => {
  const {
    title,
    category,
    departmentId,
    description,
    objectives,
    coordinatorId,
    coCoordinators,
    targetAudience,
    guestSpeaker,
    date,
    startTime,
    endTime,
    isAllDay,
    sessions,
    venueId,
    venueName,
    expectedParticipants,
    studentParticipantsCount,
    facultyParticipantsCount,
    externalParticipantsCount,
    estimatedBudget,
    fundingSource,
    isDraft
  } = data;

  // 1. Mandatory 300-word description check (Enhancement G)
  validateDescriptionWordCount(description);

  // 2. Department check
  const department = await Department.findById(departmentId);
  if (!department) {
    const error = new Error('Department not found');
    error.statusCode = 404;
    throw error;
  }

  // 3. Duplicate Activity Name Check within same Academic Year / Category
  const isDuplicate = await checkForDuplicateActivity({ title, departmentId });
  if (isDuplicate) {
    const error = new Error(`An activity titled "${title}" already exists in this department.`);
    error.statusCode = 400;
    throw error;
  }

  // 4. Scheduling & Venue Validation
  let validatedSessions = [];
  let primaryStartTime = startTime;
  let primaryEndTime = endTime;
  let primaryDate = date ? new Date(date) : new Date();
  let primaryDurationHours = 3;
  let primaryIsAllDay = !!isAllDay;
  let primaryVenueId = venueId;
  let primaryVenueName = venueName || 'TBD';

  if (Array.isArray(sessions) && sessions.length > 0) {
    // Multi-session scheduling (Enhancement B)
    validatedSessions = await validateSessionsScheduleAndCapacity({
      sessions,
      defaultVenueId: venueId
    });

    const first = validatedSessions[0];
    primaryDate = first.date;
    primaryStartTime = first.startTime;
    primaryEndTime = first.endTime;
    primaryDurationHours = first.durationHours;
    primaryIsAllDay = first.isAllDay;
    primaryVenueId = first.venueId;
    primaryVenueName = first.venueName;
  } else {
    // Single session scheduling (Enhancement A & D)
    const timeRes = validateTimeRange({ startTime, endTime, isAllDay });
    primaryStartTime = timeRes.startTime;
    primaryEndTime = timeRes.endTime;
    primaryDurationHours = timeRes.durationHours;
    primaryIsAllDay = timeRes.isAllDay;

    if (venueId) {
      await validateVenueCapacity(venueId, expectedParticipants);
      await validateAndLockVenueBooking({
        venueId,
        date: primaryDate,
        startTime: primaryStartTime,
        endTime: primaryEndTime,
        isAllDay: primaryIsAllDay
      });
    }

    validatedSessions = [
      {
        sessionTitle: title,
        date: primaryDate,
        startTime: primaryStartTime,
        endTime: primaryEndTime,
        durationHours: primaryDurationHours,
        isAllDay: primaryIsAllDay,
        venueId: primaryVenueId,
        venueName: primaryVenueName,
        expectedParticipants: expectedParticipants || 50,
        status: 'SCHEDULED'
      }
    ];
  }

  // 5. Create MongoDB Activity Record
  const status = isDraft ? 'DRAFT' : 'SUBMITTED';

  const activity = await Activity.create({
    title,
    category,
    departmentId,
    description: description.trim(),
    objectives: objectives || '',
    coordinatorId: coordinatorId || userId,
    coCoordinators: coCoordinators || [],
    hodId: department.hodId,
    targetAudience: targetAudience || 'Students & Faculty',
    guestSpeaker: guestSpeaker || {},
    date: primaryDate,
    startTime: primaryStartTime,
    endTime: primaryEndTime,
    durationHours: primaryDurationHours,
    isAllDay: primaryIsAllDay,
    venueId: primaryVenueId,
    venueName: primaryVenueName,
    sessions: validatedSessions,
    expectedParticipants: expectedParticipants || 50,
    studentParticipantsCount: studentParticipantsCount || 45,
    facultyParticipantsCount: facultyParticipantsCount || 5,
    externalParticipantsCount: externalParticipantsCount || 0,
    estimatedBudget: estimatedBudget || 0,
    fundingSource: fundingSource || 'Departmental Budget',
    status
  });

  // Calculate completeness score for baseline
  await calculateCompletenessScore(activity._id);

  // Audit and Notifications
  if (status === 'SUBMITTED') {
    await ActivityApproval.create({
      activityId: activity._id,
      action: 'PROPOSAL_SUBMITTED',
      performedBy: userId,
      role: 'FACULTY',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED',
      comments: 'Activity proposal submitted to HOD for review'
    });

    if (department.hodId) {
      await Notification.createIdempotent({
        recipientId: department.hodId,
        senderId: userId,
        title: 'New Activity Submitted for HOD Review',
        message: `Faculty coordinator submitted "${title}" for departmental review and priority recommendation.`,
        category: 'Approval',
        priority: 'HIGH',
        link: `/hod/dashboard`
      });
    }
  }

  await logAudit({
    user: { _id: userId, role: 'FACULTY' },
    action: 'ACTIVITY_CREATED',
    entity: 'Activity',
    entityId: activity._id,
    departmentName: department.name,
    details: `Activity "${title}" created. Status: ${status}`
  });

  return activity;
};

/**
 * Service: Get Activities with Role-Based Isolation & Rejected Exclusion (Change 4)
 */
export const getActivitiesService = async ({ query, user }) => {
  const { status, category, departmentId, search, isUpcoming, isCompleted, priority, includeRejected } = query;
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

  // Change 4: If no explicit status requested, default to excluding REJECTED and ARCHIVED from active lists
  if (status) {
    filter.status = status;
  } else if (includeRejected !== 'true') {
    filter.status = { $ne: 'REJECTED' };
    filter.isArchived = { $ne: true };
  }

  if (category) filter.category = category;
  if (priority && priority !== 'ALL') filter.hodPriority = priority;
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
    .populate('rejectedBy', 'name email designation role')
    .populate('changeRequests.requestedBy', 'name email designation role')
    .populate('venueId', 'name code location capacity')
    .populate('sessions.venueId', 'name code location capacity')
    .sort({ date: -1 });

  return activities;
};

/**
 * Service: Get Single Activity by ID
 */
export const getActivityByIdService = async ({ id, user }) => {
  const activity = await Activity.findById(id)
    .populate('departmentId', 'name code hodId')
    .populate('coordinatorId', 'name email designation employeeId profilePhoto')
    .populate('coCoordinators', 'name email designation')
    .populate('hodId', 'name email designation')
    .populate('hodForwardedBy', 'name email designation')
    .populate('adminDecisionBy', 'name email designation')
    .populate('rejectedBy', 'name email designation role')
    .populate('changeRequests.requestedBy', 'name email designation role')
    .populate('venueId', 'name code location capacity facilities')
    .populate('sessions.venueId', 'name code location capacity facilities');

  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  // Role-based Access Isolation Check
  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

  if (['FACULTY', 'HOD'].includes(user.role) && userDeptId !== actDeptId && activity.coordinatorId?._id?.toString() !== user._id?.toString()) {
    const error = new Error('Unauthorized: Activity belongs to another department.');
    error.statusCode = 403;
    throw error;
  }

  const media = await Media.find({ activityId: activity._id }).populate('uploadedBy', 'name role');
  const documents = await Document.find({ activityId: activity._id }).populate('uploadedBy', 'name role');
  const slotRequest = await SlotRequest.findOne({ activityId: activity._id }).populate('venueId reviewedBy');
  const report = await ActivityReport.findOne({ activityId: activity._id }).populate('submittedBy reviewedBy');
  const approvals = await ActivityApproval.find({ activityId: activity._id })
    .populate('performedBy', 'name email role designation')
    .sort({ createdAt: 1 });

  return {
    activity,
    media,
    documents,
    slotRequest,
    report,
    approvals
  };
};

/**
 * Service: Get Pending Activities for HOD Dashboard
 */
export const getPendingHodActivitiesService = async ({ user }) => {
  const userDeptId = user.departmentId?._id || user.departmentId;
  const activities = await Activity.find({
    departmentId: userDeptId,
    status: { $in: ['SUBMITTED', 'HOD_REVIEW'] },
    isArchived: { $ne: true }
  })
    .populate('departmentId', 'name code')
    .populate('coordinatorId', 'name email designation employeeId')
    .populate('venueId', 'name code location capacity')
    .populate('sessions.venueId', 'name code location capacity')
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
    isArchived: { $ne: true },
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
    .populate('sessions.venueId', 'name code location capacity')
    .sort({ updatedAt: -1 });

  return activities;
};

/**
 * Service: HOD Review & Forward Activity (Enhancements E & F, Change 3 & 4)
 */
export const hodReviewActivityService = async ({ id, action, notes, priority = 'NORMAL', priorityReason = '', user, req }) => {
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

    // Enhancement E: HOD Priority Recommendation
    const validPriorities = ['HIGH', 'MEDIUM', 'NORMAL'];
    const chosenPriority = validPriorities.includes(priority) ? priority : 'NORMAL';
    activity.hodPriority = chosenPriority;
    activity.hodPriorityReason = (priorityReason || notes || '').trim();
    activity.hodPriorityAssignedAt = new Date();
    activity.hodPriorityAssignedBy = user._id;

    await ActivityApproval.create({
      activityId: activity._id,
      action: 'HOD_FORWARDED',
      performedBy: user._id,
      role: 'HOD',
      previousStatus,
      newStatus: 'ADMIN_REVIEW',
      comments: `Priority: ${chosenPriority}. ${notes || 'Proposal forwarded to Admin'}`
    });

    // Notify all Active Admins
    const admins = await User.find({ role: 'ADMIN', status: { $in: ['APPROVED', 'ACTIVE'] } });
    for (const adm of admins) {
      await Notification.createIdempotent({
        recipientId: adm._id,
        senderId: user._id,
        title: `Activity Forwarded by HOD (${chosenPriority} Priority)`,
        message: `HOD ${user.name} reviewed and forwarded "${activity.title}" with priority ${chosenPriority} to Admin Approval Center.`,
        category: 'Approval',
        priority: chosenPriority === 'HIGH' ? 'URGENT' : 'HIGH',
        link: `/admin/approvals`
      });
    }

    // Notify Faculty Coordinator
    const coordRecipientId = activity.coordinatorId?._id || activity.coordinatorId;
    if (coordRecipientId) {
      await Notification.createIdempotent({
        recipientId: coordRecipientId,
        senderId: user._id,
        title: 'Activity Forwarded to Admin for Final Approval',
        message: `Your activity proposal "${activity.title}" was reviewed by HOD ${user.name} and forwarded to Admin for final approval (Recommended Priority: ${chosenPriority}).`,
        category: 'Approval',
        priority: 'MEDIUM',
        link: `/activities/${activity._id}`
      });
    }

    await activity.save();
    await logAudit({
      req,
      user,
      action: 'HOD_REVIEW_FORWARD',
      entity: 'Activity',
      entityId: activity._id,
      departmentName: activity.departmentId?.name,
      details: `Priority: ${chosenPriority}, Reason: ${activity.hodPriorityReason}`
    });

    return {
      success: true,
      message: `Activity proposal reviewed and forwarded to Admin with ${chosenPriority} priority recommendation.`,
      activity
    };
  } else if (action === 'REJECT') {
    // Enhancement F & Change 4: Mandatory Rejection Reason & Automatic Workflow Cleanup
    if (!notes || !notes.trim()) {
      const error = new Error('Rejection requires a mandatory explanation notes/reason');
      error.statusCode = 400;
      throw error;
    }

    activity.status = 'REJECTED';
    activity.rejectionReason = notes.trim();
    activity.hodReviewNotes = notes.trim();
    activity.rejectedBy = user._id;
    activity.rejectedAt = new Date();
    activity.rejectedRole = 'HOD';
    activity.isArchived = true;
    activity.archivedAt = new Date();
    activity.archiveReason = 'REJECTED';

    // Store immutable rejection history
    activity.rejectionHistory.push({
      reason: notes.trim(),
      rejectedBy: user._id,
      role: 'HOD',
      rejectedAt: new Date()
    });

    // Cleanup active slot reservations, offers, and waiting queue entries (Change 4)
    if (activity.sessions && activity.sessions.length > 0) {
      activity.sessions.forEach(sess => {
        sess.status = 'CANCELLED';
        sess.cancelledAt = new Date();
        sess.cancellationReason = `Activity rejected by HOD: ${notes.trim()}`;
      });
    }

    await SlotRequest.updateMany(
      { activityId: activity._id, status: { $in: ['PENDING', 'APPROVED', 'SLOT_APPROVED'] } },
      { status: 'REJECTED', rejectionReason: `Activity rejected by HOD: ${notes.trim()}` }
    );

    await SlotOffer.updateMany(
      { activityId: activity._id, status: 'OFFERED' },
      { status: 'CANCELLED', responseNotes: 'Activity proposal was rejected' }
    );

    await WaitingQueueEntry.updateMany(
      { activityId: activity._id, status: 'WAITING' },
      { status: 'CANCELLED', notes: 'Activity proposal was rejected' }
    );

    await ActivityApproval.create({
      activityId: activity._id,
      action: 'REJECTED',
      performedBy: user._id,
      role: user.role,
      previousStatus,
      newStatus: 'REJECTED',
      comments: notes.trim()
    });

    const rejectCoordId = activity.coordinatorId?._id || activity.coordinatorId;
    if (rejectCoordId) {
      await Notification.createIdempotent({
        recipientId: rejectCoordId,
        senderId: user._id,
        title: 'Activity Proposal Rejected by HOD',
        message: `Your activity proposal "${activity.title}" was rejected by HOD. Reason: ${notes.trim()}`,
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
      details: `Rejection reason: ${notes.trim()}`
    });

    return {
      success: true,
      message: 'Activity proposal rejected and removed from active workflow',
      activity
    };
  } else if (action === 'REQUEST_CHANGES') {
    // Change 3: Structured Change Request
    if (!notes || !notes.trim()) {
      const error = new Error('Requesting changes requires specific feedback notes');
      error.statusCode = 400;
      throw error;
    }

    activity.status = 'CHANGES_REQUIRED';
    activity.hodReviewNotes = notes.trim();

    activity.changeRequests.push({
      instructions: notes.trim(),
      requestedBy: user._id,
      requestedByRole: 'HOD',
      requestedAt: new Date(),
      stage: 'HOD_REVIEW',
      status: 'PENDING'
    });

    await ActivityApproval.create({
      activityId: activity._id,
      action: 'CHANGES_REQUESTED',
      performedBy: user._id,
      role: user.role,
      previousStatus,
      newStatus: 'CHANGES_REQUIRED',
      comments: notes.trim()
    });

    const changeCoordId = activity.coordinatorId?._id || activity.coordinatorId;
    if (changeCoordId) {
      await Notification.createIdempotent({
        recipientId: changeCoordId,
        senderId: user._id,
        title: 'Activity Changes Requested by HOD',
        message: `HOD requested modifications for "${activity.title}". Notes: ${notes.trim()}`,
        category: 'Approval',
        priority: 'HIGH',
        link: `/faculty/dashboard`
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
      details: `Changes requested: ${notes.trim()}`
    });

    return {
      success: true,
      message: 'Requested changes for activity proposal',
      activity
    };
  } else if (action === 'APPROVE' && user.role === 'ADMIN') {
    return await adminApproveActivityService({ id, notes, user, req });
  } else {
    const error = new Error(`Unsupported review action: ${action}`);
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Service: Update HOD Priority Recommendation
 */
export const updateHodPriorityService = async ({ id, priority, priorityReason = '', user, req }) => {
  const activity = await Activity.findById(id).populate('departmentId');
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

  if (user.role === 'HOD' && userDeptId !== actDeptId) {
    const error = new Error('Unauthorized: Cannot assign priority to activities of another department.');
    error.statusCode = 403;
    throw error;
  }

  const validPriorities = ['HIGH', 'MEDIUM', 'NORMAL'];
  if (!validPriorities.includes(priority)) {
    const error = new Error(`Invalid priority: ${priority}. Must be HIGH, MEDIUM, or NORMAL.`);
    error.statusCode = 400;
    throw error;
  }

  activity.hodPriority = priority;
  activity.hodPriorityReason = priorityReason.trim();
  activity.hodPriorityAssignedAt = new Date();
  activity.hodPriorityAssignedBy = user._id;

  await ActivityApproval.create({
    activityId: activity._id,
    action: 'PRIORITY_RECOMMENDED',
    performedBy: user._id,
    role: user.role,
    comments: `HOD updated priority recommendation to ${priority}. Reason: ${priorityReason.trim()}`
  });

  await activity.save();

  await logAudit({
    req,
    user,
    action: 'HOD_PRIORITY_UPDATED',
    entity: 'Activity',
    entityId: activity._id,
    details: `Priority: ${priority}, Reason: ${priorityReason.trim()}`
  });

  return activity;
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

  const { departmentId, category, search, status, priority } = query;
  const filter = {
    status: status || 'ADMIN_REVIEW',
    isArchived: { $ne: true }
  };

  if (departmentId) filter.departmentId = departmentId;
  if (category) filter.category = category;
  if (priority && priority !== 'ALL') filter.hodPriority = priority;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const activities = await Activity.find(filter)
    .populate('departmentId', 'name code')
    .populate('coordinatorId', 'name email designation employeeId')
    .populate('hodId', 'name email designation')
    .populate('hodForwardedBy', 'name email designation')
    .populate('adminDecisionBy', 'name email designation')
    .populate('venueId', 'name code location capacity')
    .populate('sessions.venueId', 'name code location capacity')
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

  if (!['ADMIN_REVIEW', 'SUBMITTED', 'HOD_APPROVED'].includes(activity.status)) {
    const error = new Error(`Cannot approve activity in status '${activity.status}'. Activity must be in 'ADMIN_REVIEW' stage.`);
    error.statusCode = 400;
    throw error;
  }

  // Preserve FCFS venue and slot-conflict validation
  if (Array.isArray(activity.sessions) && activity.sessions.length > 0) {
    await validateSessionsScheduleAndCapacity({
      sessions: activity.sessions,
      defaultVenueId: activity.venueId?._id || activity.venueId,
      excludeActivityId: activity._id,
      reqUser: user,
      req
    });
  } else if (activity.venueId) {
    await validateAndLockVenueBooking({
      venueId: activity.venueId._id || activity.venueId,
      date: activity.date,
      startTime: activity.startTime,
      endTime: activity.endTime,
      isAllDay: activity.isAllDay,
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
 * Service: Admin Rejection of Activity Proposal (Enhancement F & Change 4)
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
  activity.rejectionReason = reason.trim();
  activity.adminReviewNotes = reason.trim();
  activity.adminDecisionAt = new Date();
  activity.adminDecisionBy = user._id;
  activity.rejectedBy = user._id;
  activity.rejectedAt = new Date();
  activity.rejectedRole = 'ADMIN';
  activity.isArchived = true;
  activity.archivedAt = new Date();
  activity.archiveReason = 'REJECTED';

  // Store immutable rejection history
  activity.rejectionHistory.push({
    reason: reason.trim(),
    rejectedBy: user._id,
    role: 'ADMIN',
    rejectedAt: new Date()
  });

  // Cleanup active reservations, offers, waiting queue (Change 4)
  if (activity.sessions && activity.sessions.length > 0) {
    activity.sessions.forEach(sess => {
      sess.status = 'CANCELLED';
      sess.cancelledAt = new Date();
      sess.cancellationReason = `Activity rejected by Admin: ${reason.trim()}`;
    });
  }

  await SlotRequest.updateMany(
    { activityId: activity._id, status: { $in: ['PENDING', 'APPROVED', 'SLOT_APPROVED'] } },
    { status: 'REJECTED', rejectionReason: `Activity rejected by Admin: ${reason.trim()}` }
  );

  await SlotOffer.updateMany(
    { activityId: activity._id, status: 'OFFERED' },
    { status: 'CANCELLED', responseNotes: 'Activity proposal was rejected' }
  );

  await WaitingQueueEntry.updateMany(
    { activityId: activity._id, status: 'WAITING' },
    { status: 'CANCELLED', notes: 'Activity proposal was rejected' }
  );

  await ActivityApproval.create({
    activityId: activity._id,
    action: 'ADMIN_REJECTED',
    performedBy: user._id,
    role: 'ADMIN',
    previousStatus,
    newStatus: 'REJECTED',
    comments: reason.trim()
  });

  await activity.save();

  // Notify Faculty
  const adminRejectCoordId = activity.coordinatorId?._id || activity.coordinatorId;
  if (adminRejectCoordId) {
    await Notification.createIdempotent({
      recipientId: adminRejectCoordId,
      senderId: user._id,
      title: 'Activity Proposal Rejected by Admin',
      message: `Your activity proposal "${activity.title}" was rejected by Admin. Reason: ${reason.trim()}`,
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
      message: `The activity proposal "${activity.title}" was rejected by Admin. Reason: ${reason.trim()}`,
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
    details: `Rejection reason: ${reason.trim()}`
  });

  return {
    success: true,
    message: 'Activity proposal rejected and removed from active workflow',
    activity
  };
};

/**
 * Service: Admin Request Changes (Change 3)
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
  activity.adminReviewNotes = notes.trim();
  activity.adminDecisionAt = new Date();
  activity.adminDecisionBy = user._id;

  // Change 3: Structured Change Request Record
  activity.changeRequests.push({
    instructions: notes.trim(),
    requestedBy: user._id,
    requestedByRole: 'ADMIN',
    requestedAt: new Date(),
    stage: 'ADMIN_REVIEW',
    status: 'PENDING'
  });

  await ActivityApproval.create({
    activityId: activity._id,
    action: 'CHANGES_REQUESTED',
    performedBy: user._id,
    role: 'ADMIN',
    previousStatus,
    newStatus: 'CHANGES_REQUIRED',
    comments: notes.trim()
  });

  await activity.save();

  // Notify Faculty
  const adminChangeCoordId = activity.coordinatorId?._id || activity.coordinatorId;
  if (adminChangeCoordId) {
    await Notification.createIdempotent({
      recipientId: adminChangeCoordId,
      senderId: user._id,
      title: 'Corrections Requested by Admin',
      message: `Admin requested changes for "${activity.title}". Notes: ${notes.trim()}`,
      category: 'Approval',
      priority: 'HIGH',
      link: `/faculty/dashboard`
    });
  }

  // Notify HOD
  const hodRecipientId = activity.hodId?._id || activity.hodForwardedBy;
  if (hodRecipientId) {
    await Notification.createIdempotent({
      recipientId: hodRecipientId,
      senderId: user._id,
      title: 'Admin Requested Changes for Activity',
      message: `Admin requested changes for "${activity.title}". Notes: ${notes.trim()}`,
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
    details: `Requested changes: ${notes.trim()}`
  });

  return {
    success: true,
    message: 'Returned activity proposal for corrections',
    activity
  };
};

/**
 * Service: Resubmit Activity with Corrections (Change 3)
 */
export const resubmitActivityService = async ({ id, body, user, req }) => {
  const activity = await Activity.findById(id)
    .populate('coordinatorId', 'name email designation')
    .populate('departmentId', 'name code hodId');

  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  if (activity.coordinatorId._id.toString() !== user._id.toString() && user.role !== 'ADMIN') {
    const error = new Error('Unauthorized: Only the assigned coordinator can resubmit this activity.');
    error.statusCode = 403;
    throw error;
  }

  if (activity.status !== 'CHANGES_REQUIRED') {
    const error = new Error(`Cannot resubmit activity with status '${activity.status}'. It must be in 'CHANGES_REQUIRED'.`);
    error.statusCode = 400;
    throw error;
  }

  const {
    title, category, description, objectives, targetAudience, guestSpeaker,
    date, startTime, endTime, durationHours, isAllDay, sessions, venueId, venueName,
    expectedParticipants, estimatedBudget, fundingSource, resubmitNotes
  } = body;

  if (description) {
    validateDescriptionWordCount(description);
  }

  const newVenueId = venueId !== undefined ? venueId : activity.venueId;
  const newDate = date ? new Date(date) : activity.date;
  const newStartTime = startTime || activity.startTime;
  const newEndTime = endTime || activity.endTime;
  const newIsAllDay = isAllDay !== undefined ? !!isAllDay : !!activity.isAllDay;
  const newExpected = expectedParticipants !== undefined ? Number(expectedParticipants) : activity.expectedParticipants;

  if (newVenueId) {
    await validateVenueCapacity(newVenueId, newExpected);
    await validateAndLockVenueBooking({
      venueId: newVenueId,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      isAllDay: newIsAllDay,
      excludeActivityId: activity._id,
      reqUser: user,
      req
    });
  }

  if (Array.isArray(sessions) && sessions.length > 0) {
    const validatedSessions = await validateSessionsScheduleAndCapacity({
      sessions,
      defaultVenueId: newVenueId,
      excludeActivityId: activity._id,
      reqUser: user,
      req
    });
    activity.sessions = validatedSessions;
  }

  if (title) activity.title = title;
  if (category) activity.category = category;
  if (description) activity.description = description.trim();
  if (objectives !== undefined) activity.objectives = objectives;
  if (targetAudience) activity.targetAudience = targetAudience;
  if (guestSpeaker) activity.guestSpeaker = guestSpeaker;
  if (date) activity.date = newDate;
  if (startTime) activity.startTime = newStartTime;
  if (endTime) activity.endTime = newEndTime;
  if (durationHours) activity.durationHours = Number(durationHours);
  if (isAllDay !== undefined) activity.isAllDay = newIsAllDay;
  if (venueId !== undefined) activity.venueId = venueId;
  if (venueName !== undefined) activity.venueName = venueName;
  if (expectedParticipants !== undefined) activity.expectedParticipants = newExpected;
  if (estimatedBudget !== undefined) activity.estimatedBudget = Number(estimatedBudget);
  if (fundingSource) activity.fundingSource = fundingSource;

  // Resolve latest pending change request and identify which authority requested it
  let returnStage = 'HOD_REVIEW';
  if (activity.changeRequests && activity.changeRequests.length > 0) {
    const pendingRequests = activity.changeRequests.filter(cr => cr.status === 'PENDING');
    if (pendingRequests.length > 0) {
      const latestPending = pendingRequests[pendingRequests.length - 1];
      latestPending.status = 'RESUBMITTED';
      latestPending.resubmittedAt = new Date();
      latestPending.facultyNotes = (resubmitNotes || '').trim();
      returnStage = latestPending.stage || 'HOD_REVIEW';
    }
  }

  // Determine return status based on which authority requested changes
  const previousStatus = activity.status;
  const newStatus = returnStage === 'ADMIN_REVIEW' ? 'ADMIN_REVIEW' : 'SUBMITTED';
  activity.status = newStatus;

  await ActivityApproval.create({
    activityId: activity._id,
    action: 'RESUBMITTED',
    performedBy: user._id,
    role: user.role,
    previousStatus,
    newStatus,
    comments: `Coordinator resubmitted activity with corrections. Notes: ${(resubmitNotes || 'Corrections applied').trim()}`
  });

  await activity.save();

  // Notify Reviewing Authority
  if (returnStage === 'ADMIN_REVIEW') {
    const admins = await User.find({ role: 'ADMIN', status: { $in: ['APPROVED', 'ACTIVE'] } });
    for (const adm of admins) {
      await Notification.createIdempotent({
        recipientId: adm._id,
        senderId: user._id,
        title: 'Activity Resubmitted after Corrections',
        message: `Coordinator ${user.name} resubmitted "${activity.title}" with corrections for Admin approval.`,
        category: 'Approval',
        priority: 'HIGH',
        link: `/admin/approvals`
      });
    }
  } else {
    const hod = await User.findOne({ departmentId: activity.departmentId, role: 'HOD' });
    if (hod) {
      await Notification.createIdempotent({
        recipientId: hod._id,
        senderId: user._id,
        title: 'Activity Resubmitted after Corrections',
        message: `Coordinator ${user.name} resubmitted "${activity.title}" with corrections for HOD review.`,
        category: 'Approval',
        priority: 'HIGH',
        link: `/hod/dashboard`
      });
    }
  }

  await logAudit({
    req,
    user,
    action: 'ACTIVITY_RESUBMITTED',
    entity: 'Activity',
    entityId: activity._id,
    details: `Resubmitted to ${newStatus}. Notes: ${resubmitNotes || 'Corrections applied'}`
  });

  return {
    success: true,
    message: `Activity successfully resubmitted to ${newStatus === 'ADMIN_REVIEW' ? 'Admin' : 'HOD'} for review`,
    activity
  };
};

/**
 * Service: Get Activities with Changes Requested (Change 3)
 */
export const getChangesRequestedActivitiesService = async ({ user, query = {} }) => {
  const filter = { status: 'CHANGES_REQUIRED', isArchived: { $ne: true } };

  if (user.role === 'FACULTY') {
    filter.coordinatorId = user._id;
  } else if (user.role === 'HOD') {
    const userDeptId = user.departmentId?._id || user.departmentId;
    filter.departmentId = userDeptId;
  }

  const activities = await Activity.find(filter)
    .populate('departmentId', 'name code')
    .populate('coordinatorId', 'name email designation employeeId')
    .populate('venueId', 'name location capacity')
    .populate('changeRequests.requestedBy', 'name email designation role')
    .sort({ updatedAt: -1 });

  return activities;
};

/**
 * Service: Get Rejected Activities (Change 4)
 */
export const getRejectedActivitiesService = async ({ user, query = {} }) => {
  const filter = {
    $or: [
      { status: 'REJECTED' },
      { isArchived: true, archiveReason: 'REJECTED' }
    ]
  };

  if (user.role === 'FACULTY') {
    filter.coordinatorId = user._id;
  } else if (user.role === 'HOD') {
    const userDeptId = user.departmentId?._id || user.departmentId;
    filter.departmentId = userDeptId;
  }

  const activities = await Activity.find(filter)
    .populate('departmentId', 'name code')
    .populate('coordinatorId', 'name email designation employeeId')
    .populate('venueId', 'name location capacity')
    .populate('rejectedBy', 'name email designation role')
    .sort({ rejectedAt: -1, updatedAt: -1 });

  return activities;
};

/**
 * Service: Activity Booking Cancellation (Enhancement C)
 */
export const cancelActivityService = async ({ id, sessionId = null, reason, user, req }) => {
  const activity = await Activity.findById(id).populate('coordinatorId departmentId venueId');
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  // Ownership Check: Coordinator or Admin
  const coordId = activity.coordinatorId?._id?.toString() || activity.coordinatorId?.toString();
  const isCoordinator = coordId === user._id?.toString();
  if (!isCoordinator && user.role !== 'ADMIN') {
    const error = new Error('Unauthorized: You can only cancel activities you coordinate, or contact Admin.');
    error.statusCode = 403;
    throw error;
  }

  // Mandatory Reason Check
  if (!reason || !reason.trim()) {
    const error = new Error('A cancellation reason is strictly mandatory to release the reserved slot.');
    error.statusCode = 400;
    throw error;
  }

  if (activity.status === 'CANCELLED' && !sessionId) {
    const error = new Error('This activity has already been cancelled.');
    error.statusCode = 400;
    throw error;
  }
  if (['COMPLETED', 'ARCHIVED'].includes(activity.status)) {
    const error = new Error('Cannot cancel an activity that has already been completed and archived.');
    error.statusCode = 400;
    throw error;
  }

  // Last-minute cancellation check (allow up to 5 minutes before event start)
  let targetDate = activity.date;
  let targetStartTime = activity.startTime;

  if (sessionId && Array.isArray(activity.sessions)) {
    const session = activity.sessions.id(sessionId);
    if (session) {
      targetDate = session.date;
      targetStartTime = session.startTime;
    }
  }

  const now = new Date();
  const eventStartDateTime = new Date(targetDate);
  if (targetStartTime) {
    const [h, m] = targetStartTime.split(':').map(Number);
    eventStartDateTime.setHours(h, m, 0, 0);
  }

  // 5 minutes prior cutoff window
  const fiveMinutesMs = 5 * 60 * 1000;
  if (now.getTime() > (eventStartDateTime.getTime() - fiveMinutesMs) && now.getTime() > eventStartDateTime.getTime()) {
    const error = new Error('Cannot cancel an activity that has already started.');
    error.statusCode = 400;
    throw error;
  }

  let releasedVenueId = activity.venueId?._id || activity.venueId;
  let releasedDate = activity.date;
  let releasedStartTime = activity.startTime;
  let releasedEndTime = activity.endTime;
  let releasedIsAllDay = activity.isAllDay;

  if (sessionId && Array.isArray(activity.sessions)) {
    // Single session cancellation
    const session = activity.sessions.id(sessionId);
    if (!session) {
      const error = new Error('Session not found in this activity');
      error.statusCode = 404;
      throw error;
    }
    if (session.status === 'CANCELLED') {
      const error = new Error('This session has already been cancelled.');
      error.statusCode = 400;
      throw error;
    }

    session.status = 'CANCELLED';
    session.cancelledAt = new Date();
    session.cancelledBy = user._id;
    session.cancellationReason = reason.trim();

    releasedVenueId = session.venueId || releasedVenueId;
    releasedDate = session.date;
    releasedStartTime = session.startTime;
    releasedEndTime = session.endTime;
    releasedIsAllDay = session.isAllDay;

    // If all sessions cancelled, mark entire activity CANCELLED
    const activeSessions = activity.sessions.filter(s => s.status !== 'CANCELLED');
    if (activeSessions.length === 0) {
      activity.status = 'CANCELLED';
      activity.cancelledAt = new Date();
      activity.cancelledBy = user._id;
      activity.cancellationReason = reason.trim();
    }
  } else {
    // Full activity cancellation
    activity.status = 'CANCELLED';
    activity.cancelledAt = new Date();
    activity.cancelledBy = user._id;
    activity.cancellationReason = reason.trim();

    // Mark all sessions CANCELLED
    if (Array.isArray(activity.sessions)) {
      activity.sessions.forEach(sess => {
        sess.status = 'CANCELLED';
        sess.cancelledAt = new Date();
        sess.cancelledBy = user._id;
        sess.cancellationReason = reason.trim();
      });
    }

    // Cancel slot request if exists
    await SlotRequest.updateMany(
      { activityId: activity._id, status: { $in: ['PENDING', 'APPROVED', 'SLOT_APPROVED'] } },
      { status: 'CANCELLED', rejectionReason: `Activity cancelled: ${reason.trim()}` }
    );
  }

  await activity.save();

  // Create immutable CancellationHistory record
  const cancellationRecord = await CancellationHistory.create({
    activityId: activity._id,
    sessionId: sessionId || null,
    cancelledBy: user._id,
    cancellingUserRole: user.role,
    cancellingUserName: user.name,
    reason: reason.trim(),
    venueId: releasedVenueId,
    date: releasedDate,
    startTime: releasedStartTime,
    endTime: releasedEndTime,
    isAllDay: !!releasedIsAllDay,
    reallocationStatus: 'NO_ELIGIBLE_REQUEST'
  });

  // Log governance approval action
  await ActivityApproval.create({
    activityId: activity._id,
    action: 'CANCELLED',
    performedBy: user._id,
    role: user.role,
    previousStatus: activity.status,
    newStatus: 'CANCELLED',
    comments: `Booking cancelled: ${reason.trim()}`
  });

  // Trigger FCFS Waiting Queue Reallocation
  let reallocationResult = null;
  if (releasedVenueId) {
    try {
      reallocationResult = await processSlotReallocation({
        venueId: releasedVenueId,
        date: releasedDate,
        startTime: releasedStartTime,
        endTime: releasedEndTime,
        isAllDay: releasedIsAllDay,
        cancellationHistoryId: cancellationRecord._id
      });
    } catch (allocErr) {
      console.error('Smart slot reallocation error:', allocErr);
    }
  }

  // Notify HOD and Coordinator
  const hod = await User.findOne({ departmentId: activity.departmentId, role: 'HOD' });
  if (hod && hod._id.toString() !== user._id.toString()) {
    await Notification.createIdempotent({
      recipientId: hod._id,
      senderId: user._id,
      title: 'Activity Booking Cancelled',
      message: `Coordinator ${user.name} cancelled "${activity.title}". Reason: ${reason.trim()}`,
      category: 'Approval',
      priority: 'HIGH',
      link: `/activities/${activity._id}`
    });
  }

  await logAudit({
    req,
    user,
    action: 'ACTIVITY_CANCELLED',
    entity: 'Activity',
    entityId: activity._id,
    departmentName: activity.departmentId?.name,
    details: `Cancelled: ${reason.trim()}. Released slot on ${toDateString(releasedDate)} (${releasedStartTime} - ${releasedEndTime})`
  });

  return {
    success: true,
    message: 'Booking cancelled and reserved slot released immediately back to RCPIT pool.',
    activity,
    reallocation: reallocationResult
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

  const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
  const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

  if (user.role === 'HOD' && userDeptId !== actDeptId) {
    const error = new Error('Unauthorized to update activity of another department.');
    error.statusCode = 403;
    throw error;
  }

  if (user.role === 'FACULTY' && ['ADMIN_REVIEW', 'ADMIN_APPROVED', 'HOD_APPROVED', 'VERIFIED', 'COMPLETED', 'ARCHIVED'].includes(newStatus)) {
    const error = new Error('Faculty cannot directly set status to ADMIN_REVIEW, ADMIN_APPROVED, HOD_APPROVED, VERIFIED, or COMPLETED.');
    error.statusCode = 403;
    throw error;
  }

  if (user.role === 'HOD' && ['ADMIN_APPROVED', 'COMPLETED', 'ARCHIVED'].includes(newStatus)) {
    const error = new Error('HOD cannot directly set status to ADMIN_APPROVED, COMPLETED, or ARCHIVED.');
    error.statusCode = 403;
    throw error;
  }

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

  await activity.save();

  await ActivityApproval.create({
    activityId: activity._id,
    action: newStatus,
    performedBy: user._id,
    role: user.role,
    previousStatus,
    newStatus,
    comments: notes || `Status changed to ${newStatus}`
  });

  await calculateCompletenessScore(activity._id);

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
    date, startTime, endTime, durationHours, isAllDay, sessions, venueId, venueName,
    expectedParticipants, estimatedBudget, fundingSource
  } = body;

  if (description) {
    validateDescriptionWordCount(description);
  }

  const newVenueId = venueId !== undefined ? venueId : activity.venueId;
  const newDate = date ? new Date(date) : activity.date;
  const newStartTime = startTime || activity.startTime;
  const newEndTime = endTime || activity.endTime;
  const newIsAllDay = isAllDay !== undefined ? !!isAllDay : !!activity.isAllDay;
  const newExpected = expectedParticipants !== undefined ? Number(expectedParticipants) : activity.expectedParticipants;

  if (newVenueId) {
    await validateVenueCapacity(newVenueId, newExpected);
    await validateAndLockVenueBooking({
      venueId: newVenueId,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      isAllDay: newIsAllDay,
      excludeActivityId: activity._id,
      reqUser: user,
      req
    });
  }

  if (Array.isArray(sessions) && sessions.length > 0) {
    const validatedSessions = await validateSessionsScheduleAndCapacity({
      sessions,
      defaultVenueId: newVenueId,
      excludeActivityId: activity._id,
      reqUser: user,
      req
    });
    activity.sessions = validatedSessions;
  }

  if (title) activity.title = title;
  if (category) activity.category = category;
  if (description) activity.description = description.trim();
  if (objectives !== undefined) activity.objectives = objectives;
  if (targetAudience) activity.targetAudience = targetAudience;
  if (guestSpeaker) activity.guestSpeaker = guestSpeaker;
  if (date) activity.date = newDate;
  if (startTime) activity.startTime = newStartTime;
  if (endTime) activity.endTime = newEndTime;
  if (durationHours) activity.durationHours = Number(durationHours);
  if (isAllDay !== undefined) activity.isAllDay = newIsAllDay;
  if (venueId !== undefined) activity.venueId = venueId;
  if (venueName !== undefined) activity.venueName = venueName;
  if (expectedParticipants !== undefined) activity.expectedParticipants = newExpected;
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
