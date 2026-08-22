import Activity from '../models/Activity.js';
import SlotRequest from '../models/SlotRequest.js';

export const checkVenueConflict = async ({ venueId, requestedDate, startTime, endTime, excludeActivityId = null }) => {
  const reqDate = new Date(requestedDate);
  const startOfDay = new Date(reqDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(reqDate.setHours(23, 59, 59, 999));

  // Find all approved/scheduled slot requests or activities on the same date & venue
  const query = {
    venueId,
    requestedDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['APPROVED', 'SLOT_APPROVED'] }
  };

  const existingSlots = await SlotRequest.find(query).populate('activityId', 'title departmentId');

  let conflictFound = null;

  for (const slot of existingSlots) {
    if (excludeActivityId && slot.activityId?._id?.toString() === excludeActivityId.toString()) {
      continue;
    }

    // Compare time intervals e.g. "10:00" to "13:00" vs "11:30" to "14:00"
    if (isTimeOverlapping(startTime, endTime, slot.startTime, slot.endTime)) {
      conflictFound = {
        hasConflict: true,
        conflictingActivityId: slot.activityId?._id,
        conflictingActivityTitle: slot.activityId?.title || 'Existing Scheduled Event',
        existingSlot: `${slot.startTime} - ${slot.endTime}`,
        conflictMessage: `Venue conflict detected with existing event "${slot.activityId?.title || 'Scheduled Event'}" (${slot.startTime} - ${slot.endTime}).`
      };
      break;
    }
  }

  // Also generate 3 alternative available slots if conflict found
  let alternativeSlots = [];
  if (conflictFound) {
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
        date: new Date(new Date(requestedDate).setDate(new Date(requestedDate).getDate() + 1)),
        startTime: '10:00',
        endTime: '13:00',
        label: 'Next Day - Morning Session (10:00 - 13:00)'
      },
      {
        venueId,
        date: new Date(new Date(requestedDate).setDate(new Date(requestedDate).getDate() + 2)),
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
  const toMins = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const aStart = toMins(startA);
  const aEnd = toMins(endA);
  const bStart = toMins(startB);
  const bEnd = toMins(endB);

  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}
