import { checkSlotAvailability, isTimeOverlapping as isTimeOverlappingService } from '../services/slotService.js';

export const isTimeOverlapping = isTimeOverlappingService;

export const checkVenueConflict = async (params) => {
  const res = await checkSlotAvailability(params);
  return {
    hasConflict: res.hasConflict,
    conflictDetails: res.conflictDetails || { hasConflict: false, conflictMessage: '' },
    alternativeSlots: res.alternativeSlots || []
  };
};
