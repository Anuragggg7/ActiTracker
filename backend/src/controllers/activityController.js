import Activity from '../models/Activity.js';
import Media from '../models/Media.js';
import ActivityReport from '../models/ActivityReport.js';
import {
  createActivityService,
  getActivitiesService,
  getActivityByIdService,
  getPendingHodActivitiesService,
  getForwardedHodActivitiesService,
  hodReviewActivityService,
  updateHodPriorityService,
  getPendingAdminActivitiesService,
  adminApproveActivityService,
  adminRejectActivityService,
  adminRequestChangesActivityService,
  cancelActivityService,
  updateActivityStatusService,
  updateActivityService,
  updateActivityBudgetService,
  getActivityApprovalsService
} from '../services/activityService.js';
import { getCancellationHistoryService, SlotConflictError } from '../services/slotService.js';

// Create Activity
export const createActivity = async (req, res) => {
  try {
    const activity = await createActivityService({
      body: req.body,
      user: req.user,
      req
    });

    const isDraft = req.body.isDraft;
    res.status(201).json({
      success: true,
      message: isDraft ? 'Activity saved as draft' : 'Activity submitted to HOD for review',
      activity
    });
  } catch (error) {
    if (error instanceof SlotConflictError || error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        code: 'SLOT_ALREADY_BOOKED',
        isDuplicate: error.isDuplicate || false,
        matchingActivity: error.matchingActivity || null,
        message: error.message || 'This time slot has been booked already!',
        conflictDetails: error.conflictDetails,
        alternativeSlots: error.alternativeSlots
      });
    }
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      venueCapacityExceeded: error.venueCapacityExceeded || false,
      configuredCapacity: error.configuredCapacity,
      requestedCount: error.requestedCount,
      alternativeVenues: error.alternativeVenues || []
    });
  }
};

// Get Activities (Filtered by Role & Department Isolation)
export const getActivities = async (req, res) => {
  try {
    const activities = await getActivitiesService({
      query: req.query,
      user: req.user
    });

    res.json({ success: true, count: activities.length, activities });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Activity Details by ID (With Access Control)
export const getActivityById = async (req, res) => {
  try {
    const data = await getActivityByIdService({
      id: req.params.id,
      user: req.user
    });

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Pending HOD Activities for Department
export const getPendingHodActivities = async (req, res) => {
  try {
    const activities = await getPendingHodActivitiesService({ user: req.user });
    res.json({ success: true, count: activities.length, activities });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Forwarded Activities for HOD
export const getForwardedHodActivities = async (req, res) => {
  try {
    const activities = await getForwardedHodActivitiesService({ user: req.user });
    res.json({ success: true, count: activities.length, activities });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// HOD Review / Forward Activity (Enhancements E & F)
export const reviewActivityByHod = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes, priority, priorityReason } = req.body;

    const result = await hodReviewActivityService({
      id,
      action: action || 'FORWARD',
      notes,
      priority: priority || 'NORMAL',
      priorityReason: priorityReason || '',
      user: req.user,
      req
    });

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Update HOD Priority Recommendation
export const updateHodPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, priorityReason } = req.body;

    const activity = await updateHodPriorityService({
      id,
      priority,
      priorityReason,
      user: req.user,
      req
    });

    res.json({
      success: true,
      message: `Priority recommendation updated to ${priority}`,
      activity
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Dedicated Endpoint: Forward Activity to Admin (HOD)
export const forwardActivityToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, priority, priorityReason } = req.body;

    const result = await hodReviewActivityService({
      id,
      action: 'FORWARD',
      notes,
      priority: priority || 'NORMAL',
      priorityReason: priorityReason || '',
      user: req.user,
      req
    });

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Pending Admin Activities (Activity Approval Center)
export const getPendingAdminActivities = async (req, res) => {
  try {
    const activities = await getPendingAdminActivitiesService({
      user: req.user,
      query: req.query
    });

    res.json({ success: true, count: activities.length, activities });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Admin Final Approval
export const adminApproveActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await adminApproveActivityService({
      id,
      notes,
      user: req.user,
      req
    });

    res.json(result);
  } catch (error) {
    if (error instanceof SlotConflictError || error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        code: 'SLOT_ALREADY_BOOKED',
        message: 'This time slot has been booked already!',
        conflictDetails: error.conflictDetails,
        alternativeSlots: error.alternativeSlots
      });
    }
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Admin Rejection (Enhancement F)
export const adminRejectActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await adminRejectActivityService({
      id,
      reason,
      user: req.user,
      req
    });

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Admin Request Changes
export const adminRequestChangesActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await adminRequestChangesActivityService({
      id,
      notes,
      user: req.user,
      req
    });

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Cancel Activity Booking (Enhancement C: Immediate slot release and FCFS waiting queue trigger)
export const cancelActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, reason } = req.body;

    const result = await cancelActivityService({
      id,
      sessionId,
      reason,
      user: req.user,
      req
    });

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Cancellation History
export const getCancellationHistory = async (req, res) => {
  try {
    const history = await getCancellationHistoryService({
      activityId: req.params.id || req.query.activityId,
      user: req.user
    });

    res.json({ success: true, count: history.length, history });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Transition Event Status with State Machine & Role Security Validation
export const updateActivityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, notes } = req.body;

    const activity = await updateActivityStatusService({
      id,
      newStatus,
      notes,
      user: req.user,
      req
    });

    res.json({ success: true, message: `Activity status updated to ${newStatus}`, activity });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Edit Activity Details
export const updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await updateActivityService({
      id,
      body: req.body,
      user: req.user,
      req
    });

    res.json({ success: true, message: 'Activity updated successfully', activity });
  } catch (error) {
    if (error instanceof SlotConflictError || error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        code: 'SLOT_ALREADY_BOOKED',
        message: 'This time slot has been booked already!',
        conflictDetails: error.conflictDetails,
        alternativeSlots: error.alternativeSlots
      });
    }
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Update Activity Budget & Expenses
export const updateActivityBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await updateActivityBudgetService({
      id,
      body: req.body,
      user: req.user,
      req
    });

    res.json({ success: true, message: 'Activity budget updated successfully', activity });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Get Approval History / Audit Trail
export const getActivityApprovals = async (req, res) => {
  try {
    const approvals = await getActivityApprovalsService({ activityId: req.params.id });
    res.json({ success: true, count: approvals.length, approvals });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
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
