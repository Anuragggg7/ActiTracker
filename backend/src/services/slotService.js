import SlotRequest from '../models/SlotRequest.js';
import Activity from '../models/Activity.js';
import Venue from '../models/Venue.js';
import SlotLock from '../models/SlotLock.js';
import Notification from '../models/Notification.js';
import WaitingQueueEntry from '../models/WaitingQueueEntry.js';
import SlotOffer from '../models/SlotOffer.js';
import CancellationHistory from '../models/CancellationHistory.js';
import ActivityApproval from '../models/ActivityApproval.js';
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

// Convert "HH:mm" to total minutes from midnight
export const timeToMinutes = (t) => {
  if (!t || typeof t !== 'string') return 0;
  const parts = t.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};

// Institutional Scheduling Range Validation: 06:00 AM (360m) to 10:00 PM (1320m)
export const INSTITUTIONAL_START_MINUTES = 6 * 60;   // 06:00
export const INSTITUTIONAL_END_MINUTES = 22 * 60;   // 22:00

export function validateTimeRange({ startTime, endTime, isAllDay = false }) {
  if (isAllDay) {
    return {
      startTime: '06:00',
      endTime: '22:00',
      durationHours: 16,
      isAllDay: true
    };
  }

  if (!startTime || !endTime) {
    const error = new Error('Both start time and end time are required.');
    error.statusCode = 400;
    throw error;
  }

  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);

  if (startMins >= endMins) {
    const error = new Error(`Start time (${startTime}) must be strictly earlier than end time (${endTime}).`);
    error.statusCode = 400;
    throw error;
  }

  if (startMins < INSTITUTIONAL_START_MINUTES || endMins > INSTITUTIONAL_END_MINUTES) {
    const error = new Error(`Scheduling times must be within the institutional operating window: 06:00 AM to 10:00 PM (Received ${startTime} - ${endTime}).`);
    error.statusCode = 400;
    throw error;
  }

  const durationHours = Math.round(((endMins - startMins) / 60) * 10) / 10;
  return {
    startTime,
    endTime,
    durationHours: durationHours > 0 ? durationHours : 1,
    isAllDay: false
  };
}

// Check if two time slots overlap on the same date (adjacent slots like 10:00-11:00 and 11:00-12:00 do NOT overlap)
export function isTimeOverlapping(startA, endA, startB, endB, isAllDayA = false, isAllDayB = false) {
  if (isAllDayA || isAllDayB) {
    return true; // All-Day reservations reserve the venue for the full operating period
  }
  if (!startA || !endA || !startB || !endB) return false;

  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

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

// Get Timezone-Safe Date Range for MongoDB Query (Asia/Kolkata +5:30 safe window)
export function getDateSearchWindow(dInput) {
  const d = new Date(dInput);
  const startOfDay = new Date(d);
  startOfDay.setUTCHours(0, 0, 0, 0);
  startOfDay.setHours(startOfDay.getHours() - 14); // Buffer for timezone shifts

  const endOfDay = new Date(d);
  endOfDay.setUTCHours(23, 59, 59, 999);
  endOfDay.setHours(endOfDay.getHours() + 14);

  return { startOfDay, endOfDay, targetDateStr: toDateString(dInput) };
}

// Atomic concurrency-safe lock for a Venue & Date string
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

  throw new SlotConflictError('This venue time slot is currently being processed by another user. Please retry shortly.');
};

// Enhancement D: Venue Capacity Validation
export const validateVenueCapacity = async (venueId, expectedParticipants) => {
  if (!venueId || expectedParticipants === undefined || expectedParticipants === null) return;
  const count = Number(expectedParticipants);
  if (isNaN(count) || count <= 0) return;

  const venue = await Venue.findById(venueId);
  if (!venue) {
    const error = new Error('Selected institutional venue does not exist.');
    error.statusCode = 404;
    throw error;
  }

  if (count > venue.capacity) {
    const alternativeVenues = await Venue.find({
      active: true,
      capacity: { $gte: count },
      _id: { $ne: venue._id }
    })
      .select('name code capacity location')
      .sort({ capacity: 1 })
      .limit(4);

    const error = new Error(
      `Expected participants (${count}) exceeds selected venue capacity (${venue.capacity}) for "${venue.name}". Please select a larger venue or adjust participant count.`
    );
    error.statusCode = 400;
    error.venueCapacityExceeded = true;
    error.configuredCapacity = venue.capacity;
    error.requestedCount = count;
    error.alternativeVenues = alternativeVenues;
    throw error;
  }

  return venue;
};

// Check Slot Availability against MongoDB Atlas
export const checkSlotAvailability = async ({
  venueId,
  requestedDate,
  startTime,
  endTime,
  isAllDay = false,
  excludeActivityId = null,
  excludeSlotRequestId = null,
  excludeSessionId = null
}) => {
  if (!venueId || !requestedDate || (!isAllDay && (!startTime || !endTime))) {
    return {
      available: true,
      hasConflict: false,
      message: 'Time slot parameters incomplete'
    };
  }

  const { startOfDay, endOfDay, targetDateStr } = getDateSearchWindow(requestedDate);
  let conflictFound = null;

  // 1. Check existing active/approved SlotRequest records (exclude CANCELLED and REJECTED)
  const slotQuery = {
    venueId,
    $or: [
      { requestedDate: { $gte: startOfDay, $lte: endOfDay } },
      { date: { $gte: startOfDay, $lte: endOfDay } }
    ],
    status: { $in: ['APPROVED', 'SLOT_APPROVED', 'PENDING'] }
  };

  const existingSlots = await SlotRequest.find(slotQuery).populate('activityId', 'title departmentId status');

  for (const slot of existingSlots) {
    if (excludeSlotRequestId && slot._id.toString() === excludeSlotRequestId.toString()) continue;
    if (excludeActivityId && slot.activityId?._id?.toString() === excludeActivityId.toString()) continue;
    if (slot.activityId?.status === 'CANCELLED') continue;

    const slotDateStr = toDateString(slot.requestedDate || slot.date);
    if (slotDateStr === targetDateStr && isTimeOverlapping(startTime, endTime, slot.startTime, slot.endTime, isAllDay, false)) {
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

  // 2. Check existing Activity records (excluding CANCELLED and DRAFT)
  if (!conflictFound) {
    const actQuery = {
      $or: [
        { venueId, date: { $gte: startOfDay, $lte: endOfDay } },
        { 'sessions.venueId': venueId, 'sessions.date': { $gte: startOfDay, $lte: endOfDay } }
      ],
      status: {
        $nin: ['DRAFT', 'REJECTED', 'CANCELLED']
      }
    };
    if (excludeActivityId) {
      actQuery._id = { $ne: excludeActivityId };
    }

    const existingActivities = await Activity.find(actQuery);

    for (const act of existingActivities) {
      if (conflictFound) break;

      // Check multi-session records first
      if (Array.isArray(act.sessions) && act.sessions.length > 0) {
        for (const session of act.sessions) {
          if (session.status === 'CANCELLED') continue;
          if (excludeSessionId && session._id?.toString() === excludeSessionId.toString()) continue;

          const sVenueId = session.venueId?.toString() || act.venueId?.toString();
          if (sVenueId === venueId.toString()) {
            const sDateStr = toDateString(session.date);
            if (
              sDateStr === targetDateStr &&
              isTimeOverlapping(startTime, endTime, session.startTime, session.endTime, isAllDay, session.isAllDay)
            ) {
              conflictFound = {
                hasConflict: true,
                conflictingActivityId: act._id,
                conflictingActivityTitle: `${act.title}${session.sessionTitle ? ` (${session.sessionTitle})` : ''}`,
                existingSlot: session.isAllDay ? 'All-Day' : `${session.startTime} - ${session.endTime}`,
                conflictMessage: `This time slot has been booked already!`
              };
              break;
            }
          }
        }
      }

      // Check primary schedule if no conflict from sessions was matched
      if (!conflictFound && act.venueId && act.venueId.toString() === venueId.toString()) {
        const actDateStr = toDateString(act.date);
        if (
          actDateStr === targetDateStr &&
          isTimeOverlapping(startTime, endTime, act.startTime, act.endTime, isAllDay, act.isAllDay)
        ) {
          conflictFound = {
            hasConflict: true,
            conflictingActivityId: act._id,
            conflictingActivityTitle: act.title,
            existingSlot: act.isAllDay ? 'All-Day' : `${act.startTime} - ${act.endTime}`,
            conflictMessage: `This time slot has been booked already!`
          };
          break;
        }
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

// Validate Multi-Session / Multi-Occurrence Schedules
export const validateSessionsScheduleAndCapacity = async ({
  sessions,
  defaultVenueId = null,
  excludeActivityId = null,
  reqUser = null,
  req = null
}) => {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const validatedSessions = [];

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const sessionVenueId = s.venueId || defaultVenueId;
    const sessionIndexName = s.sessionTitle || `Session ${i + 1}`;

    const timeValidation = validateTimeRange({
      startTime: s.startTime,
      endTime: s.endTime,
      isAllDay: !!s.isAllDay
    });

    let venueName = s.venueName || 'TBD';
    if (sessionVenueId) {
      const venueDoc = await validateVenueCapacity(sessionVenueId, s.expectedParticipants);
      if (venueDoc) venueName = venueDoc.name;

      // Check conflict against database
      const availability = await checkSlotAvailability({
        venueId: sessionVenueId,
        requestedDate: s.date,
        startTime: timeValidation.startTime,
        endTime: timeValidation.endTime,
        isAllDay: timeValidation.isAllDay,
        excludeActivityId
      });

      if (!availability.available) {
        throw new SlotConflictError(
          `Schedule conflict for ${sessionIndexName} on ${toDateString(s.date)} at ${venueName} (${timeValidation.startTime} - ${timeValidation.endTime}). This slot is already booked.`,
          availability.conflictDetails,
          availability.alternativeSlots
        );
      }
    }

    // Intra-payload collision check (prevent proposing overlapping slots for the same venue on the same day in one activity)
    for (let j = 0; j < validatedSessions.length; j++) {
      const prev = validatedSessions[j];
      const prevVenue = prev.venueId || defaultVenueId;
      if (sessionVenueId && prevVenue && sessionVenueId.toString() === prevVenue.toString()) {
        if (toDateString(s.date) === toDateString(prev.date)) {
          if (
            isTimeOverlapping(
              timeValidation.startTime,
              timeValidation.endTime,
              prev.startTime,
              prev.endTime,
              timeValidation.isAllDay,
              prev.isAllDay
            )
          ) {
            throw new SlotConflictError(
              `Conflicting internal occurrences: ${sessionIndexName} overlaps with ${prev.sessionTitle || `Session ${j + 1}`} on ${toDateString(s.date)} at the same venue.`
            );
          }
        }
      }
    }

    validatedSessions.push({
      sessionTitle: s.sessionTitle || `Session ${i + 1}`,
      date: new Date(s.date),
      startTime: timeValidation.startTime,
      endTime: timeValidation.endTime,
      durationHours: timeValidation.durationHours,
      isAllDay: timeValidation.isAllDay,
      venueId: sessionVenueId || null,
      venueName,
      expectedParticipants: Number(s.expectedParticipants) || 50,
      status: s.status || 'SCHEDULED'
    });
  }

  return validatedSessions;
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
    }).populate('activityId', 'title category status'),
    Activity.find({
      $or: [
        { venueId, date: { $gte: startOfDay, $lte: endOfDay } },
        { 'sessions.venueId': venueId, 'sessions.date': { $gte: startOfDay, $lte: endOfDay } }
      ],
      status: { $nin: ['DRAFT', 'REJECTED', 'CANCELLED'] }
    })
  ]);

  const occupiedSlotsMap = new Map();

  existingSlots.forEach((slot) => {
    if (slot.activityId?.status === 'CANCELLED') return;
    if (toDateString(slot.requestedDate || slot.date) === targetDateStr) {
      const key = `${slot.startTime}-${slot.endTime}`;
      occupiedSlotsMap.set(key, {
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: slot.activityId?.title || 'Booked Slot',
        status: slot.status,
        isAllDay: false
      });
    }
  });

  existingActivities.forEach((act) => {
    // Check sessions
    if (Array.isArray(act.sessions) && act.sessions.length > 0) {
      act.sessions.forEach((sess) => {
        if (sess.status === 'CANCELLED') return;
        const sVenueId = sess.venueId?.toString() || act.venueId?.toString();
        if (sVenueId === venueId.toString() && toDateString(sess.date) === targetDateStr) {
          const key = sess.isAllDay ? '06:00-22:00' : `${sess.startTime}-${sess.endTime}`;
          occupiedSlotsMap.set(key, {
            startTime: sess.isAllDay ? '06:00' : sess.startTime,
            endTime: sess.isAllDay ? '22:00' : sess.endTime,
            title: `${act.title}${sess.sessionTitle ? ` (${sess.sessionTitle})` : ''}`,
            status: act.status,
            isAllDay: sess.isAllDay
          });
        }
      });
    } else if (act.venueId && act.venueId.toString() === venueId.toString()) {
      if (toDateString(act.date) === targetDateStr) {
        const key = act.isAllDay ? '06:00-22:00' : `${act.startTime}-${act.endTime}`;
        occupiedSlotsMap.set(key, {
          startTime: act.isAllDay ? '06:00' : act.startTime,
          endTime: act.isAllDay ? '22:00' : act.endTime,
          title: act.title,
          status: act.status,
          isAllDay: act.isAllDay
        });
      }
    }
  });

  return {
    venueId,
    date: dateInput,
    occupiedSlots: Array.from(occupiedSlotsMap.values())
  };
};

// Atomic Create Slot Request Service
export const createSlotRequestService = async ({ activityId, venueId, requestedDate, startTime, endTime, isAllDay = false, reqUser, req }) => {
  const activity = await Activity.findById(activityId);
  if (!activity) throw new Error('Activity not found');

  const timeValidation = validateTimeRange({ startTime, endTime, isAllDay });
  await validateVenueCapacity(venueId, activity.expectedParticipants);

  const releaseLock = await acquireSlotLock(venueId, requestedDate);

  try {
    const availability = await checkSlotAvailability({
      venueId,
      requestedDate,
      startTime: timeValidation.startTime,
      endTime: timeValidation.endTime,
      isAllDay: timeValidation.isAllDay,
      excludeActivityId: activityId
    });

    if (!availability.available) {
      await logAudit({
        req,
        user: reqUser,
        action: 'SLOT_BOOKING_CONFLICT',
        entity: 'SlotRequest',
        details: `Venue: ${venueId}, Date: ${requestedDate}, Time: ${timeValidation.startTime}-${timeValidation.endTime}, Reason: Slot Already Booked`
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
      startTime: timeValidation.startTime,
      endTime: timeValidation.endTime,
      status: 'PENDING'
    });

    activity.status = 'SLOT_REQUESTED';
    activity.venueId = venueId;
    activity.isAllDay = timeValidation.isAllDay;
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
      details: `Activity: ${activity.title}, Venue: ${venue?.name || venueId}, Time: ${timeValidation.startTime}-${timeValidation.endTime}`
    });

    return slotReq;
  } finally {
    await releaseLock();
  }
};

// Review Slot Request Service
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
export const validateAndLockVenueBooking = async ({
  venueId,
  date,
  startTime,
  endTime,
  isAllDay = false,
  excludeActivityId = null,
  reqUser,
  req
}) => {
  if (!venueId || !date) return;

  const timeValidation = validateTimeRange({ startTime, endTime, isAllDay });

  const releaseLock = await acquireSlotLock(venueId, date);
  try {
    const availability = await checkSlotAvailability({
      venueId,
      requestedDate: date,
      startTime: timeValidation.startTime,
      endTime: timeValidation.endTime,
      isAllDay: timeValidation.isAllDay,
      excludeActivityId
    });

    if (!availability.available) {
      await logAudit({
        req,
        user: reqUser,
        action: 'SLOT_BOOKING_CONFLICT',
        entity: 'Activity',
        details: `Venue: ${venueId}, Date: ${date}, Time: ${timeValidation.startTime}-${timeValidation.endTime}, Conflict Reason: Slot Already Booked`
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

// ============================================================================
// ENHANCEMENT C: SMART SLOT REALLOCATION & FCFS WAITING QUEUE SERVICES
// ============================================================================

/**
 * Service: Add Request to FCFS Waiting Queue
 */
export const addToWaitingQueueService = async ({
  activityId,
  sessionId = null,
  venueId,
  date,
  startTime,
  endTime,
  isAllDay = false,
  notes = '',
  user,
  req
}) => {
  const activity = await Activity.findById(activityId);
  if (!activity) {
    const error = new Error('Activity not found');
    error.statusCode = 404;
    throw error;
  }

  const timeValidation = validateTimeRange({ startTime, endTime, isAllDay });
  await validateVenueCapacity(venueId, activity.expectedParticipants);

  // Avoid duplicate queue entries for the same activity and slot
  const existingQueue = await WaitingQueueEntry.findOne({
    activityId,
    venueId,
    date: new Date(date),
    status: 'WAITING'
  });

  if (existingQueue) {
    return existingQueue;
  }

  const queueEntry = await WaitingQueueEntry.create({
    activityId,
    sessionId: sessionId || null,
    requestedBy: user._id,
    departmentId: activity.departmentId,
    venueId,
    date: new Date(date),
    startTime: timeValidation.startTime,
    endTime: timeValidation.endTime,
    isAllDay: timeValidation.isAllDay,
    expectedParticipants: activity.expectedParticipants,
    queueTimestamp: new Date(), // Server-generated FCFS timestamp
    status: 'WAITING',
    eligibilityStatus: ['ADMIN_APPROVED', 'HOD_APPROVED', 'SCHEDULED'].includes(activity.status) ? 'APPROVED' : 'PENDING_APPROVAL',
    priority: activity.hodPriority || 'NORMAL',
    notes: notes || 'Enqueued in FCFS waiting queue'
  });

  await logAudit({
    req,
    user,
    action: 'WAITING_QUEUE_JOINED',
    entity: 'WaitingQueueEntry',
    entityId: queueEntry._id,
    details: `Activity "${activity.title}" joined FCFS queue for venue ${venueId} on ${toDateString(date)}`
  });

  return queueEntry;
};

/**
 * Service: Process Released Slot Reallocation to Next Eligible Requester in Queue
 */
export const processSlotReallocation = async ({
  venueId,
  date,
  startTime,
  endTime,
  isAllDay = false,
  cancellationHistoryId = null,
  req = null
}) => {
  if (!venueId || !date) return null;

  const { startOfDay, endOfDay, targetDateStr } = getDateSearchWindow(date);

  // 1. Find all eligible waiting requests for this venue and date ordered strictly by FCFS (queueTimestamp ascending)
  const waitingEntries = await WaitingQueueEntry.find({
    venueId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: 'WAITING',
    eligibilityStatus: 'APPROVED'
  })
    .sort({ queueTimestamp: 1 })
    .populate('activityId requestedBy');

  const venueDoc = await Venue.findById(venueId);

  for (const entry of waitingEntries) {
    const entryDateStr = toDateString(entry.date);
    if (entryDateStr !== targetDateStr) continue;

    // Time window compatibility check
    if (!isTimeOverlapping(startTime, endTime, entry.startTime, entry.endTime, isAllDay, entry.isAllDay)) {
      continue;
    }

    const activity = entry.activityId;
    if (!activity || activity.status === 'CANCELLED' || activity.status === 'COMPLETED') {
      entry.status = 'CANCELLED';
      await entry.save();
      continue;
    }

    // Capacity verification
    if (venueDoc && entry.expectedParticipants > venueDoc.capacity) {
      continue;
    }

    // 2. Offer the slot to this top-priority FCFS requester with a response deadline (e.g. 24 hours or up to event start)
    const offerExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const eventStartDate = new Date(entry.date);
    const [h, m] = (entry.startTime || '10:00').split(':').map(Number);
    eventStartDate.setHours(h || 10, m || 0, 0, 0);

    // If event is less than 24 hours away, set expiration to 1 hour before event
    const finalExpiresAt = (eventStartDate.getTime() - 60 * 60 * 1000 < offerExpiresAt.getTime())
      ? new Date(Math.max(Date.now() + 15 * 60 * 1000, eventStartDate.getTime() - 60 * 60 * 1000))
      : offerExpiresAt;

    const offer = await SlotOffer.create({
      waitingQueueId: entry._id,
      activityId: activity._id,
      sessionId: entry.sessionId,
      venueId,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      isAllDay: entry.isAllDay,
      offeredToUser: entry.requestedBy._id,
      offeredAt: new Date(),
      expiresAt: finalExpiresAt,
      status: 'OFFERED'
    });

    entry.status = 'OFFERED';
    await entry.save();

    if (cancellationHistoryId) {
      await CancellationHistory.findByIdAndUpdate(cancellationHistoryId, {
        reallocationStatus: 'OFFERED',
        reallocatedOfferId: offer._id
      });
    }

    // Record ActivityApproval
    await ActivityApproval.create({
      activityId: activity._id,
      action: 'SLOT_OFFERED',
      performedBy: entry.requestedBy._id,
      role: 'SYSTEM',
      comments: `Released venue slot at ${venueDoc?.name || 'Assigned Venue'} offered via FCFS waiting queue. Response required by ${finalExpiresAt.toLocaleString()}.`
    });

    // Notify requester
    await Notification.createIdempotent({
      recipientId: entry.requestedBy._id,
      title: 'Released Venue Slot Available — Action Required!',
      message: `A reserved slot at ${venueDoc?.name || 'Selected Venue'} on ${toDateString(entry.date)} (${entry.startTime} - ${entry.endTime}) has been released and offered to you! Please accept or decline by ${finalExpiresAt.toLocaleTimeString()}.`,
      category: 'Slot',
      priority: 'HIGH',
      link: '/faculty'
    });

    await logAudit({
      req,
      user: { _id: entry.requestedBy._id, name: 'System Scheduler', role: 'SYSTEM' },
      action: 'SLOT_OFFER_GENERATED',
      entity: 'SlotOffer',
      entityId: offer._id,
      details: `Slot at ${venueDoc?.name} on ${toDateString(entry.date)} offered to user ${entry.requestedBy.name} for activity "${activity.title}"`
    });

    return offer; // Only offer to top eligible FCFS requester
  }

  return null;
};

/**
 * Service: Respond to Slot Offer (ACCEPT or DECLINE)
 */
export const respondToSlotOfferService = async ({ offerId, action, responseNotes = '', user, req }) => {
  const offer = await SlotOffer.findById(offerId).populate('waitingQueueId activityId venueId');
  if (!offer) {
    const error = new Error('Slot offer not found');
    error.statusCode = 404;
    throw error;
  }

  // Authorization check
  const offerUserId = offer.offeredToUser.toString();
  if (offerUserId !== user._id.toString() && user.role !== 'ADMIN') {
    const error = new Error('Unauthorized: You can only respond to slot offers assigned to your account.');
    error.statusCode = 403;
    throw error;
  }

  if (offer.status !== 'OFFERED') {
    const error = new Error(`This slot offer has already been ${offer.status.toLowerCase()}.`);
    error.statusCode = 400;
    throw error;
  }

  if (new Date() > new Date(offer.expiresAt)) {
    offer.status = 'EXPIRED';
    await offer.save();
    if (offer.waitingQueueId) {
      await WaitingQueueEntry.findByIdAndUpdate(offer.waitingQueueId._id, { status: 'EXPIRED' });
    }
    // Re-trigger queue for the next requester
    processSlotReallocation({
      venueId: offer.venueId._id || offer.venueId,
      date: offer.date,
      startTime: offer.startTime,
      endTime: offer.endTime,
      isAllDay: offer.isAllDay,
      req
    }).catch(err => console.error('Post-expiration reallocation error:', err));

    const error = new Error('This slot offer has expired and has been offered to the next eligible requester.');
    error.statusCode = 410;
    throw error;
  }

  const venueId = offer.venueId._id || offer.venueId;
  const venueName = offer.venueId?.name || 'Assigned Venue';

  if (action === 'ACCEPT') {
    // Atomic race-condition safe lock
    const releaseLock = await acquireSlotLock(venueId, offer.date);
    try {
      // Check final availability
      const availability = await checkSlotAvailability({
        venueId,
        requestedDate: offer.date,
        startTime: offer.startTime,
        endTime: offer.endTime,
        isAllDay: offer.isAllDay,
        excludeActivityId: offer.activityId?._id
      });

      if (!availability.available) {
        offer.status = 'EXPIRED';
        await offer.save();
        throw new SlotConflictError('Unable to confirm: Slot has already been allocated or is no longer available.');
      }

      offer.status = 'ACCEPTED';
      offer.respondedAt = new Date();
      offer.responseNotes = responseNotes || 'Offer accepted by faculty requester';
      await offer.save();

      if (offer.waitingQueueId) {
        await WaitingQueueEntry.findByIdAndUpdate(offer.waitingQueueId._id, { status: 'ACCEPTED' });
      }

      // Update Activity Booking
      const activity = await Activity.findById(offer.activityId._id);
      if (activity) {
        activity.venueId = venueId;
        activity.venueName = venueName;
        activity.date = offer.date;
        activity.startTime = offer.startTime;
        activity.endTime = offer.endTime;
        activity.isAllDay = offer.isAllDay;
        activity.status = 'SCHEDULED';

        // Update session if sessionId present
        if (offer.sessionId && Array.isArray(activity.sessions)) {
          const sess = activity.sessions.id(offer.sessionId);
          if (sess) {
            sess.venueId = venueId;
            sess.venueName = venueName;
            sess.date = offer.date;
            sess.startTime = offer.startTime;
            sess.endTime = offer.endTime;
            sess.isAllDay = offer.isAllDay;
            sess.status = 'SCHEDULED';
          }
        }

        await activity.save();

        await ActivityApproval.create({
          activityId: activity._id,
          action: 'SLOT_REALLOCATED',
          performedBy: user._id,
          role: user.role,
          comments: `Slot at ${venueName} accepted via Smart Slot Reallocation. Event scheduled.`
        });
      }

      // Update CancellationHistory records that pointed to this slot
      await CancellationHistory.updateMany(
        { venueId, date: offer.date, reallocationStatus: 'OFFERED' },
        { reallocationStatus: 'REALLOCATED', reallocatedToActivityId: activity?._id }
      );

      // Notify User and Admin
      await Notification.createIdempotent({
        recipientId: user._id,
        title: 'Slot Claim Confirmed — Event Scheduled!',
        message: `Your acceptance has been confirmed. Activity "${activity?.title}" is officially scheduled at ${venueName} on ${toDateString(offer.date)} (${offer.startTime} - ${offer.endTime}).`,
        category: 'Slot',
        priority: 'HIGH',
        link: `/activities/${activity?._id}`
      });

      await logAudit({
        req,
        user,
        action: 'SLOT_OFFER_ACCEPTED',
        entity: 'SlotOffer',
        entityId: offer._id,
        details: `Slot at ${venueName} accepted by ${user.name} for activity "${activity?.title}"`
      });

      return {
        success: true,
        message: 'Slot offer accepted successfully. Activity is officially scheduled!',
        offer,
        activity
      };
    } finally {
      await releaseLock();
    }
  } else if (action === 'DECLINE') {
    offer.status = 'DECLINED';
    offer.respondedAt = new Date();
    offer.responseNotes = responseNotes || 'Declined by faculty requester';
    await offer.save();

    if (offer.waitingQueueId) {
      await WaitingQueueEntry.findByIdAndUpdate(offer.waitingQueueId._id, { status: 'DECLINED' });
    }

    await logAudit({
      req,
      user,
      action: 'SLOT_OFFER_DECLINED',
      entity: 'SlotOffer',
      entityId: offer._id,
      details: `Slot at ${venueName} declined by ${user.name}`
    });

    // Re-trigger allocation immediately for the next FCFS requester in queue
    processSlotReallocation({
      venueId,
      date: offer.date,
      startTime: offer.startTime,
      endTime: offer.endTime,
      isAllDay: offer.isAllDay,
      req
    }).catch(err => console.error('Post-decline reallocation error:', err));

    return {
      success: true,
      message: 'Slot offer declined. Slot has been returned to the waiting queue.',
      offer
    };
  } else {
    const error = new Error(`Invalid action: ${action}. Must be 'ACCEPT' or 'DECLINE'.`);
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Service: Get Active Slot Offers for User
 */
export const getActiveSlotOffersService = async ({ user }) => {
  const query = { status: 'OFFERED', expiresAt: { $gt: new Date() } };
  if (user.role !== 'ADMIN' && user.role !== 'DIRECTOR') {
    query.offeredToUser = user._id;
  }

  const offers = await SlotOffer.find(query)
    .populate('activityId', 'title category departmentId coordinatorId')
    .populate('venueId', 'name code location capacity')
    .sort({ createdAt: -1 });

  return offers;
};

/**
 * Service: Get Waiting Queue Entries
 */
export const getWaitingQueueService = async ({ venueId, activityId, user }) => {
  const query = {};
  if (venueId) query.venueId = venueId;
  if (activityId) query.activityId = activityId;
  if (user.role === 'FACULTY') query.requestedBy = user._id;
  if (user.role === 'HOD' && user.departmentId) query.departmentId = user.departmentId._id || user.departmentId;

  const entries = await WaitingQueueEntry.find(query)
    .populate('activityId', 'title category status hodPriority')
    .populate('venueId', 'name code capacity location')
    .populate('requestedBy', 'name email designation')
    .sort({ queueTimestamp: 1 });

  return entries;
};

/**
 * Service: Get Cancellation History
 */
export const getCancellationHistoryService = async ({ activityId, user }) => {
  const query = {};
  if (activityId) query.activityId = activityId;
  if (user.role === 'FACULTY') query.cancelledBy = user._id;

  const history = await CancellationHistory.find(query)
    .populate('activityId', 'title category departmentId')
    .populate('venueId', 'name code location')
    .populate('cancelledBy', 'name email role designation')
    .populate('reallocatedToActivityId', 'title category')
    .sort({ cancelledAt: -1 })
    .limit(100);

  return history;
};
