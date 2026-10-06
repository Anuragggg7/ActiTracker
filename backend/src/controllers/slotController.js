import SlotRequest from '../models/SlotRequest.js';
import Venue from '../models/Venue.js';
import { logAudit } from '../utils/auditLogger.js';
import {
  checkSlotAvailability,
  getVenueScheduleService,
  createSlotRequestService,
  reviewSlotRequestService,
  SlotConflictError
} from '../services/slotService.js';

// GET /api/slots/availability
export const checkAvailabilityController = async (req, res) => {
  try {
    const { venueId, date, requestedDate, startTime, endTime, excludeActivityId, excludeSlotRequestId } = req.query;
    const targetDate = date || requestedDate;

    const result = await checkSlotAvailability({
      venueId,
      requestedDate: targetDate,
      startTime,
      endTime,
      excludeActivityId,
      excludeSlotRequestId
    });

    if (!result.available) {
      return res.status(409).json({
        success: false,
        available: false,
        code: 'SLOT_ALREADY_BOOKED',
        message: 'This time slot has been booked already!',
        conflictDetails: result.conflictDetails,
        alternativeSlots: result.alternativeSlots
      });
    }

    res.json({
      success: true,
      available: true,
      message: 'Time slot is available'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/slots/venue-schedule
export const getVenueScheduleController = async (req, res) => {
  try {
    const { venueId, date, requestedDate } = req.query;
    const targetDate = date || requestedDate;

    const schedule = await getVenueScheduleService(venueId, targetDate);
    res.json({ success: true, ...schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/slots/requests - Create Slot Request with Atomic FCFS
export const createSlotRequest = async (req, res) => {
  try {
    const { activityId, venueId, requestedDate, date, startTime, endTime } = req.body;
    const targetDate = requestedDate || date;

    const slotReq = await createSlotRequestService({
      activityId,
      venueId,
      requestedDate: targetDate,
      startTime,
      endTime,
      reqUser: req.user,
      req
    });

    res.status(201).json({
      success: true,
      message: 'Slot request submitted successfully to Admin.',
      slotRequest: slotReq
    });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/slots/requests/:id/review or /api/slots/review/:id - Review Slot Request with Atomic FCFS
export const reviewSlotRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, selectedAlternativeIndex, adminNotes } = req.body;

    const slotReq = await reviewSlotRequestService({
      requestId: id,
      action,
      adminNotes,
      selectedAlternativeIndex,
      reqUser: req.user,
      req
    });

    res.json({
      success: true,
      message: `Slot request ${action.toLowerCase()}d successfully`,
      slotRequest: slotReq
    });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/slots/requests
export const getSlotRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const slotRequests = await SlotRequest.find(query)
      .populate({
        path: 'activityId',
        populate: { path: 'departmentId coordinatorId' }
      })
      .populate('venueId requestedBy reviewedBy')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: slotRequests.length, requests: slotRequests, slotRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Venue CRUD
export const getVenues = async (req, res) => {
  try {
    const venues = await Venue.find({}).sort({ name: 1 });
    res.json({ success: true, count: venues.length, venues });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createVenue = async (req, res) => {
  try {
    const { name, code, capacity, location, facilities } = req.body;

    const existing = await Venue.findOne({ $or: [{ name }, { code }] });
    if (existing) return res.status(400).json({ success: false, message: 'Venue name or code already exists' });

    const venue = await Venue.create({
      name,
      code,
      capacity: Number(capacity) || 100,
      location,
      facilities: facilities || []
    });

    await logAudit({ req, user: req.user, action: 'VENUE_CREATED', entity: 'Venue', entityId: venue._id, details: `Name: ${name}` });

    res.status(201).json({ success: true, venue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await Venue.findById(id);
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });

    await Venue.findByIdAndDelete(id);

    await logAudit({ req, user: req.user, action: 'VENUE_DELETED', entity: 'Venue', entityId: id, details: `Name: ${venue.name} (${venue.code})` });

    res.json({ success: true, message: `Venue "${venue.name}" removed successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
