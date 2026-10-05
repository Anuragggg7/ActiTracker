import Activity from '../models/Activity.js';
import SlotRequest from '../models/SlotRequest.js';

export const checkVenueConflict = async ({ venueId, requestedDate, startTime, endTime, excludeActivityId = null, excludeSlotRequestId = null }) => {
  if (!venueId || !requestedDate || !startTime || !endTime) {
    return { hasConflict: false, conflictDetails: { hasConflict: false, conflictMessage: '' }, alternativeSlots: [] };
  }

  const reqDate = new Date(requestedDate);
  const startOfDay = new Date(new Date(reqDate).setHours(0, 0, 0, 0));
  const endOfDay = new Date(new Date(reqDate).setHours(23, 59, 59, 999));

  let conflictFound = null;

  // 1. Check existing SlotRequest records
  const slotQuery = {
    venueId,
    $or: [
      { requestedDate: { $gte: startOfDay, $lte: endOfDay } },
      { date: { $gte: startOfDay, $lte: endOfDay } }
    ],
    status: { $in: ['APPROVED', 'SLOT_APPROVED'] }
  };

  const existingSlots = await SlotRequest.find(slotQuery).populate('activityId', 'title departmentId');

  for (const slot of existingSlots) {
    if (excludeSlotRequestId && slot._id.toString() === excludeSlotRequestId.toString()) continue;
    if (excludeActivityId && slot.activityId?._id?.toString() === excludeActivityId.toString()) continue;

    if (isTimeOverlapping(startTime, endTime, slot.startTime, slot.endTime)) {
      conflictFound = {
        hasConflict: true,
        conflictingActivityId: slot.activityId?._id,
        conflictingActivityTitle: slot.activityId?.title || 'Existing Scheduled Event',
        existingSlot: `${slot.startTime} - ${slot.endTime}`,
        conflictMessage: `Venue conflict detected with existing booked slot "${slot.activityId?.title || 'Scheduled Event'}" (${slot.startTime} - ${slot.endTime}).`
      };
      break;
    }
  }

  // 2. Check existing Activity records directly
  if (!conflictFound) {
    const actQuery = {
      venueId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['SCHEDULED', 'SLOT_APPROVED', 'HOD_APPROVED', 'CONDUCTED', 'COMPLETED'] }
    };
    if (excludeActivityId) {
      actQuery._id = { $ne: excludeActivityId };
    }

    const existingActivities = await Activity.find(actQuery);

    for (const act of existingActivities) {
      if (isTimeOverlapping(startTime, endTime, act.startTime, act.endTime)) {
        conflictFound = {
          hasConflict: true,
          conflictingActivityId: act._id,
          conflictingActivityTitle: act.title,
          existingSlot: `${act.startTime} - ${act.endTime}`,
          conflictMessage: `Venue conflict detected with confirmed event "${act.title}" (${act.startTime} - ${act.endTime}).`
        };
        break;
      }
    }
  }

  // Generate 3 alternative available slots if conflict found
  let alternativeSlots = [];
  if (conflictFound) {
    const nextDay = new Date(reqDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayAfter = new Date(reqDate);
    dayAfter.setDate(dayAfter.getDate() + 2);

    alternativeSlots = [
      {
        venueId,
        date: reqDate,
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

  return {
    hasConflict: !!conflictFound,
    conflictDetails: conflictFound || { hasConflict: false, conflictMessage: '' },
    alternativeSlots
  };
};

function isTimeOverlapping(startA, endA, startB, endB) {
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
