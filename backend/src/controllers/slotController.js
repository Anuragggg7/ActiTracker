import SlotRequest from '../models/SlotRequest.js';
import Activity from '../models/Activity.js';
import Venue from '../models/Venue.js';
import Notification from '../models/Notification.js';
import { checkVenueConflict } from '../utils/conflictDetector.js';
import { logAudit } from '../utils/auditLogger.js';

// Create Slot Request
export const createSlotRequest = async (req, res) => {
  try {
    const { activityId, venueId, requestedDate, startTime, endTime } = req.body;

    const activity = await Activity.findById(activityId);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    // Check venue conflict
    const conflictCheck = await checkVenueConflict({
      venueId,
      requestedDate,
      startTime,
      endTime,
      excludeActivityId: activityId
    });

    const slotReq = await SlotRequest.create({
      activityId,
      requestedBy: req.user._id,
      venueId,
      requestedDate: new Date(requestedDate),
      startTime,
      endTime,
      status: conflictCheck.hasConflict ? 'CONFLICT_DETECTED' : 'PENDING',
      conflictDetails: conflictCheck.conflictDetails,
      suggestedAlternatives: conflictCheck.alternativeSlots
    });

    activity.status = 'SLOT_REQUESTED';
    activity.venueId = venueId;
    const venue = await Venue.findById(venueId);
    if (venue) activity.venueName = venue.name;
    await activity.save();

    // Notify Admin
    await Notification.createIdempotent({
      recipientId: req.user._id, // Will also notify Admin via system query
      title: conflictCheck.hasConflict ? 'Slot Request Conflict Warning' : 'Slot Request Submitted',
      message: conflictCheck.hasConflict
        ? `Conflict detected for "${activity.title}". Admin will verify alternative slots.`
        : `Slot request for "${activity.title}" sent to Admin for verification.`,
      category: 'Slot',
      priority: conflictCheck.hasConflict ? 'HIGH' : 'MEDIUM'
    });

    await logAudit({ req, user: req.user, action: 'SLOT_REQUESTED', entity: 'SlotRequest', entityId: slotReq._id, details: `Activity: ${activity.title}` });

    res.status(201).json({
      success: true,
      message: conflictCheck.hasConflict
        ? 'Slot request created but scheduling conflict detected. Admin will review alternative slots.'
        : 'Slot request submitted successfully to Admin.',
      slotRequest: slotReq,
      hasConflict: conflictCheck.hasConflict
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Review Slot Request (Approve / Reject / Suggest Alternative)
export const reviewSlotRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, selectedAlternativeIndex, adminNotes } = req.body; // 'APPROVE', 'REJECT', 'APPLY_ALTERNATIVE'

    const slotReq = await SlotRequest.findById(id).populate('activityId venueId requestedBy');
    if (!slotReq) return res.status(404).json({ success: false, message: 'Slot request not found' });

    const targetActId = slotReq.activityId?._id || slotReq.activityId;
    const activity = await Activity.findById(targetActId);

    if (action === 'APPROVE') {
      // Server-side final concurrency check
      const finalCheck = await checkVenueConflict({
        venueId: slotReq.venueId?._id || slotReq.venueId,
        requestedDate: slotReq.requestedDate || slotReq.date,
        startTime: slotReq.startTime,
        endTime: slotReq.endTime,
        excludeSlotRequestId: slotReq._id,
        excludeActivityId: targetActId
      });

      if (finalCheck.hasConflict) {
        slotReq.status = 'CONFLICT_DETECTED';
        slotReq.conflictDetails = finalCheck.conflictDetails;
        slotReq.suggestedAlternatives = finalCheck.alternativeSlots;
        await slotReq.save();
        return res.status(409).json({
          success: false,
          message: `Cannot approve: ${finalCheck.conflictDetails.conflictMessage || 'This time slot is already booked.'}`,
          hasConflict: true
        });
      }

      slotReq.status = 'APPROVED';
      slotReq.reviewedBy = req.user._id;
      slotReq.adminNotes = adminNotes || 'Slot approved by Admin';
      slotReq.reviewedAt = new Date();

      if (activity) {
        activity.status = 'SCHEDULED';
        activity.venueId = slotReq.venueId?._id || slotReq.venueId;
        activity.venueName = slotReq.venueId?.name || 'Assigned Venue';
        activity.date = slotReq.requestedDate || slotReq.date;
        activity.startTime = slotReq.startTime;
        activity.endTime = slotReq.endTime;
        await activity.save();
      }

      const recipientId = slotReq.requestedBy?._id || slotReq.requestedBy;
      const vName = slotReq.venueId?.name || activity?.venueName || 'Assigned Venue';

      await Notification.createIdempotent({
        recipientId,
        senderId: req.user._id,
        title: 'Slot Approved & Scheduled',
        message: `Your slot request for "${activity?.title || 'Activity'}" at ${vName} on ${new Date(slotReq.requestedDate || slotReq.date).toLocaleDateString()} has been APPROVED!`,
        category: 'Slot',
        priority: 'HIGH'
      });
    } else if (action === 'APPLY_ALTERNATIVE' && slotReq.suggestedAlternatives[selectedAlternativeIndex]) {
      const alt = slotReq.suggestedAlternatives[selectedAlternativeIndex];
      slotReq.venueId = alt.venueId || slotReq.venueId;
      slotReq.requestedDate = alt.date;
      slotReq.startTime = alt.startTime;
      slotReq.endTime = alt.endTime;
      slotReq.status = 'APPROVED';
      slotReq.adminNotes = adminNotes || 'Alternative slot applied by Admin';

      if (activity) {
        activity.status = 'SCHEDULED';
        activity.date = alt.date;
        activity.startTime = alt.startTime;
        activity.endTime = alt.endTime;
        await activity.save();
      }

      const recipientId = slotReq.requestedBy?._id || slotReq.requestedBy;

      await Notification.createIdempotent({
        recipientId,
        senderId: req.user._id,
        title: 'Alternative Slot Assigned & Scheduled',
        message: `An alternative slot for "${activity?.title || 'Activity'}" has been assigned for ${new Date(alt.date).toLocaleDateString()} (${alt.startTime} - ${alt.endTime}).`,
        category: 'Slot',
        priority: 'HIGH'
      });
    } else if (action === 'REJECT') {
      slotReq.status = 'REJECTED';
      slotReq.adminNotes = adminNotes || 'Slot request rejected due to venue unavailability';

      if (activity) {
        activity.status = 'CHANGES_REQUIRED';
        activity.adminSlotNotes = adminNotes;
        await activity.save();
      }
    }

    await slotReq.save();

    await logAudit({ req, user: req.user, action: `ADMIN_SLOT_${action}`, entity: 'SlotRequest', entityId: slotReq._id, details: adminNotes });

    res.json({ success: true, message: `Slot request ${action.toLowerCase()}d successfully`, slotRequest: slotReq });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// List Slot Requests (Admin / Faculty / HOD)
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

    res.json({ success: true, count: slotRequests.length, slotRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Venue CRUD (Admin & Viewing for all)
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
