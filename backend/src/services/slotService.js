import SlotRequest from '../models/SlotRequest.js';
import Activity from '../models/Activity.js';
import Venue from '../models/Venue.js';
import SlotLock from '../models/SlotLock.js';
import Notification from '../models/Notification.js';
import { logAudit } from '../utils/auditLogger.js';

export class SlotConflictError extends Error {
  constructor(message = 'This time slot has been booked already!', conflictDetails = null, alternativeSlots = []) {
    super(message);
    this.name = 'SlotConflictError';
    this.statusCode = 409;
    this.code = 'SLOT_ALREADY_BOOKED';
    this.conflictDetails = conflictDetails;
    this.alternativeSlots = alternativeSlots;
  }
}

export function isTimeOverlapping(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  const toMins = (t) => {
    const parts = t.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  const aStart = toMins(startA);
  const aEnd = toMins(endA);
  const bStart = toMins(startB);
  const bEnd = toMins(endB);

  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Format Date object or String to 'YYYY-MM-DD'
export function toDateString(dInput) {
  if (!dInput) return '';
  const d = new Date(dInput);
  if (isNaN(d.getTime())) return String(dInput).split('T')[0];
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Get Timezone-Safe Date Range for MongoDB Query
function getDateSearchWindow(dInput) {
  const d = new Date(dInput);
  const startOfDay = new Date(d);
  startOfDay.setUTCHours(0, 0, 0, 0);
  startOfDay.setHours(startOfDay.getHours() - 14); // 14h buffer for timezone shifts

  const endOfDay = new Date(d);
  endOfDay.setUTCHours(23, 59, 59, 999);
  endOfDay.setHours(endOfDay.getHours() + 14);

  return { startOfDay, endOfDay, targetDateStr: toDateString(dInput) };
}

// Acquire Process & DB Atomic Lock for a Venue & Date string
export const acquireSlotLock = async (venueId, dateInput, maxRetries = 30, retryDelayMs = 50) => {
  const dateStr = toDateString(dateInput);
  const lockKey = `venue_lock_${venueId}_${dateStr}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const lockDoc = await SlotLock.create({ lockKey, createdAt: new Date() });
      return async () => {
        try {
          await SlotLock.deleteOne({ _id: lockDoc._id });
        } catch (err) {
          // Silent catch on cleanup
        }
      };
    } catch (err) {
      if (err.code === 11000) {
        await sleep(retryDelayMs);
      } else {
        throw err;
      }
    }
  }

  throw new SlotConflictError('This time slot has been booked already! (Server busy, retry lock timeout)');
};

// Check Slot Availability against MongoDB Atlas
export const checkSlotAvailability = async ({
  venueId,
  requestedDate,
  startTime,
  endTime,
  excludeActivityId = null,
  excludeSlotRequestId = null
}) => {
  if (!venueId || !requestedDate || !startTime || !endTime) {
    return {
      available: true,
      hasConflict: false,
      message: 'Time slot parameters incomplete'
    };
  }

  const { startOfDay, endOfDay, targetDateStr } = getDateSearchWindow(requestedDate);

  let conflictFound = null;

  // 1. Check existing active/approved SlotRequest records (including PENDING to uphold FCFS priority)
  const slotQuery = {
    venueId,
    $or: [
      { requestedDate: { $gte: startOfDay, $lte: endOfDay } },
      { date: { $gte: startOfDay, $lte: endOfDay } }
    ],
    status: { $in: ['APPROVED', 'SLOT_APPROVED', 'PENDING'] }
  };

  const existingSlots = await SlotRequest.find(slotQuery).populate('activityId', 'title departmentId');

  for (const slot of existingSlots) {
    if (excludeSlotRequestId && slot._id.toString() === excludeSlotRequestId.toString()) continue;
    if (excludeActivityId && slot.activityId?._id?.toString() === excludeActivityId.toString()) continue;

    const slotDateStr = toDateString(slot.requestedDate || slot.date);
    if (slotDateStr === targetDateStr && isTimeOverlapping(startTime, endTime, slot.startTime, slot.endTime)) {
      conflictFound = {
        hasConflict: true,
        conflictingActivityId: slot.activityId?._id,
        conflictingActivityTitle: slot.activityId?.title || 'Existing Scheduled Event',
        existingSlot: `${slot.startTime} - ${slot.endTime}`,
        conflictMessage: `This time slot has been booked already!`
      };
      break;
    }
  }

  // 2. Check existing Activity records directly
  if (!conflictFound) {
    const actQuery = {
      venueId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['SUBMITTED', 'HOD_REVIEW', 'ADMIN_REVIEW', 'ADMIN_APPROVED', 'HOD_APPROVED', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'REPORT_SUBMITTED', 'VERIFICATION', 'COMPLETED'] }
    };
    if (excludeActivityId) {
      actQuery._id = { $ne: excludeActivityId };
    }

    const existingActivities = await Activity.find(actQuery);
    console.log(`[checkSlotAvailability Debug] venueId=${venueId} date=${requestedDate} targetDateStr=${targetDateStr} foundActivitiesCount=${existingActivities.length}`);

    for (const act of existingActivities) {
      const actDateStr = toDateString(act.date);
      if (actDateStr === targetDateStr && isTimeOverlapping(startTime, endTime, act.startTime, act.endTime)) {
        conflictFound = {
          hasConflict: true,
          conflictingActivityId: act._id,
          conflictingActivityTitle: act.title,
          existingSlot: `${act.startTime} - ${act.endTime}`,
          conflictMessage: `This time slot has been booked already!`
        };
        break;
      }
    }
  }

  // Generate alternative available slots if conflict found
  let alternativeSlots = [];
  if (conflictFound) {
    const reqDateObj = new Date(requestedDate);
    const nextDay = new Date(reqDateObj);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayAfter = new Date(reqDateObj);
    dayAfter.setDate(dayAfter.getDate() + 2);

    alternativeSlots = [
      {
        venueId,
        date: requestedDate,
        startTime: '14:00',
        endTime: '17:00',
        label: 'Same Day - Afternoon Session (14:00 - 17:00)'
      },
      {
        venueId,
        date: nextDay,
        startTime: '10:00',
        endTime: '13:00',
        label: 'Next Day - Morning Session (10:00 - 13:00)'
      },
      {
        venueId,
        date: dayAfter,
        startTime: '11:00',
        endTime: '14:00',
        label: '2 Days Later - Midday Session (11:00 - 14:00)'
      }
    ];
  }

  if (conflictFound) {
    return {
      available: false,
      hasConflict: true,
      code: 'SLOT_ALREADY_BOOKED',
      message: 'This time slot has been booked already!',
      conflictDetails: conflictFound,
      alternativeSlots
    };
  }

  return {
    available: true,
    hasConflict: false,
    message: 'Time slot is available'
  };
};

// Get Venue Schedule (List of Occupied Slots for Date & Venue)
export const getVenueScheduleService = async (venueId, dateInput) => {
  if (!venueId || !dateInput) return { occupiedSlots: [] };

  const { startOfDay, endOfDay, targetDateStr } = getDateSearchWindow(dateInput);

  const [existingSlots, existingActivities] = await Promise.all([
    SlotRequest.find({
      venueId,
      $or: [
        { requestedDate: { $gte: startOfDay, $lte: endOfDay } },
        { date: { $gte: startOfDay, $lte: endOfDay } }
      ],
      status: { $in: ['APPROVED', 'SLOT_APPROVED', 'PENDING'] }
    }).populate('activityId', 'title category'),
    Activity.find({
      venueId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['SUBMITTED', 'HOD_REVIEW', 'ADMIN_REVIEW', 'ADMIN_APPROVED', 'HOD_APPROVED', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'REPORT_SUBMITTED', 'VERIFICATION', 'COMPLETED'] }
    })
  ]);

  const occupiedSlotsMap = new Map();

  existingSlots.forEach((slot) => {
    if (toDateString(slot.requestedDate || slot.date) === targetDateStr) {
      const key = `${slot.startTime}-${slot.endTime}`;
      occupiedSlotsMap.set(key, {
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: slot.activityId?.title || 'Booked Slot',
        status: slot.status
      });
    }
  });

  existingActivities.forEach((act) => {
    if (toDateString(act.date) === targetDateStr) {
      const key = `${act.startTime}-${act.endTime}`;
      occupiedSlotsMap.set(key, {
        startTime: act.startTime,
        endTime: act.endTime,
        title: act.title,
        status: act.status
      });
    }
  });

  return {
    venueId,
    date: dateInput,
    occupiedSlots: Array.from(occupiedSlotsMap.values())
  };
};

// Atomic Create Slot Request Service
export const createSlotRequestService = async ({ activityId, venueId, requestedDate, startTime, endTime, reqUser, req }) => {
  const activity = await Activity.findById(activityId);
  if (!activity) throw new Error('Activity not found');

  const releaseLock = await acquireSlotLock(venueId, requestedDate);

  try {
    const availability = await checkSlotAvailability({
      venueId,
      requestedDate,
      startTime,
      endTime,
      excludeActivityId: activityId
    });

    if (!availability.available) {
      await logAudit({
        req,
        user: reqUser,
        action: 'SLOT_BOOKING_CONFLICT',
        entity: 'SlotRequest',
        details: `Venue: ${venueId}, Date: ${requestedDate}, Time: ${startTime}-${endTime}, Reason: Slot Already Booked`
      });

      throw new SlotConflictError(
        'This time slot has been booked already!',
        availability.conflictDetails,
        availability.alternativeSlots
      );
    }

    const slotReq = await SlotRequest.create({
      activityId,
      requestedBy: reqUser._id,
      venueId,
      requestedDate: new Date(requestedDate),
      startTime,
      endTime,
      status: 'PENDING'
    });

    activity.status = 'SLOT_REQUESTED';
    activity.venueId = venueId;
    const venue = await Venue.findById(venueId);
    if (venue) activity.venueName = venue.name;
    await activity.save();

    await Notification.createIdempotent({
      recipientId: reqUser._id,
      title: 'Slot Request Submitted',
      message: `Slot request for "${activity.title}" sent to Admin for verification.`,
      category: 'Slot',
      priority: 'MEDIUM'
    });

    await logAudit({
      req,
      user: reqUser,
      action: 'SLOT_BOOKED',
      entity: 'SlotRequest',
      entityId: slotReq._id,
      details: `Activity: ${activity.title}, Venue: ${venue?.name || venueId}, Time: ${startTime}-${endTime}`
    });

    return slotReq;
  } finally {
    await releaseLock();
  }
};

// Atomic Review Slot Request Service
export const reviewSlotRequestService = async ({ requestId, action, adminNotes, selectedAlternativeIndex, reqUser, req }) => {
  const slotReq = await SlotRequest.findById(requestId).populate('activityId venueId requestedBy');
  if (!slotReq) throw new Error('Slot request not found');

  const targetActId = slotReq.activityId?._id || slotReq.activityId;
  const targetVenueId = slotReq.venueId?._id || slotReq.venueId;
  const targetDate = slotReq.requestedDate || slotReq.date;

  const activity = await Activity.findById(targetActId);

  if (action === 'APPROVE') {
    const releaseLock = await acquireSlotLock(targetVenueId, targetDate);
    try {
      const finalCheck = await checkSlotAvailability({
        venueId: targetVenueId,
        requestedDate: targetDate,
        startTime: slotReq.startTime,
        endTime: slotReq.endTime,
        excludeSlotRequestId: slotReq._id,
        excludeActivityId: targetActId
      });

      if (!finalCheck.available) {
        slotReq.status = 'CONFLICT_DETECTED';
        slotReq.conflictDetails = finalCheck.conflictDetails;
        slotReq.suggestedAlternatives = finalCheck.alternativeSlots;
        await slotReq.save();

        await logAudit({
          req,
          user: reqUser,
          action: 'SLOT_BOOKING_CONFLICT',
          entity: 'SlotRequest',
          entityId: slotReq._id,
          details: `Admin approval rejected: Slot already booked.`
        });

        throw new SlotConflictError(
          'This time slot has been booked already!',
          finalCheck.conflictDetails,
          finalCheck.alternativeSlots
        );
      }

      slotReq.status = 'APPROVED';
      slotReq.reviewedBy = reqUser._id;
      slotReq.adminNotes = adminNotes || 'Slot approved by Admin';
      slotReq.reviewedAt = new Date();

      if (activity) {
        activity.status = 'SCHEDULED';
        activity.venueId = targetVenueId;
        activity.venueName = slotReq.venueId?.name || 'Assigned Venue';
        activity.date = targetDate;
        activity.startTime = slotReq.startTime;
        activity.endTime = slotReq.endTime;
        await activity.save();
      }

      const recipientId = slotReq.requestedBy?._id || slotReq.requestedBy;
      const vName = slotReq.venueId?.name || activity?.venueName || 'Assigned Venue';

      await Notification.createIdempotent({
        recipientId,
        senderId: reqUser._id,
        title: 'Slot Approved & Scheduled',
        message: `Your slot request for "${activity?.title || 'Activity'}" at ${vName} on ${new Date(targetDate).toLocaleDateString()} has been APPROVED!`,
        category: 'Slot',
        priority: 'HIGH'
      });

      await slotReq.save();

      await logAudit({
        req,
        user: reqUser,
        action: 'SLOT_BOOKED',
        entity: 'SlotRequest',
        entityId: slotReq._id,
        details: `Approved by Admin: ${adminNotes || 'Venue allocated'}`
      });

      return slotReq;
    } finally {
      await releaseLock();
    }
  } else if (action === 'APPLY_ALTERNATIVE' && slotReq.suggestedAlternatives[selectedAlternativeIndex]) {
    const alt = slotReq.suggestedAlternatives[selectedAlternativeIndex];
    const altVenueId = alt.venueId || targetVenueId;
    const altDate = alt.date;

    const releaseLock = await acquireSlotLock(altVenueId, altDate);
    try {
      const altCheck = await checkSlotAvailability({
        venueId: altVenueId,
        requestedDate: altDate,
        startTime: alt.startTime,
        endTime: alt.endTime,
        excludeSlotRequestId: slotReq._id,
        excludeActivityId: targetActId
      });

      if (!altCheck.available) {
        throw new SlotConflictError('This time slot has been booked already!');
      }

      slotReq.venueId = altVenueId;
      slotReq.requestedDate = altDate;
      slotReq.startTime = alt.startTime;
      slotReq.endTime = alt.endTime;
      slotReq.status = 'APPROVED';
      slotReq.adminNotes = adminNotes || 'Alternative slot applied by Admin';

      if (activity) {
        activity.status = 'SCHEDULED';
        activity.date = altDate;
        activity.startTime = alt.startTime;
        activity.endTime = alt.endTime;
        await activity.save();
      }

      await slotReq.save();
      return slotReq;
    } finally {
      await releaseLock();
    }
  } else if (action === 'REJECT') {
    slotReq.status = 'REJECTED';
    slotReq.adminNotes = adminNotes || 'Slot request rejected due to venue unavailability';

    if (activity) {
      activity.status = 'CHANGES_REQUIRED';
      activity.adminSlotNotes = adminNotes;
      await activity.save();
    }

    await slotReq.save();

    await logAudit({
      req,
      user: reqUser,
      action: 'SLOT_REQUEST_REJECTED',
      entity: 'SlotRequest',
      entityId: slotReq._id,
      details: adminNotes
    });

    return slotReq;
  }
};

// Validate and Lock Venue for Direct Activity Creation / Editing
export const validateAndLockVenueBooking = async ({ venueId, date, startTime, endTime, excludeActivityId = null, reqUser, req }) => {
  if (!venueId || !date || !startTime || !endTime) return;

  const releaseLock = await acquireSlotLock(venueId, date);
  try {
    const availability = await checkSlotAvailability({
      venueId,
      requestedDate: date,
      startTime,
      endTime,
      excludeActivityId
    });

    if (!availability.available) {
      await logAudit({
        req,
        user: reqUser,
        action: 'SLOT_BOOKING_CONFLICT',
        entity: 'Activity',
        details: `Venue: ${venueId}, Date: ${date}, Time: ${startTime}-${endTime}, Conflict Reason: Slot Already Booked`
      });

      throw new SlotConflictError(
        'This time slot has been booked already!',
        availability.conflictDetails,
        availability.alternativeSlots
      );
    }
  } finally {
    await releaseLock();
  }
};
