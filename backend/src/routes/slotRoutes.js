import express from 'express';
import {
  checkAvailabilityController,
  getVenueScheduleController,
  createSlotRequest,
  reviewSlotRequest,
  getSlotRequests,
  getVenues,
  createVenue,
  deleteVenue,
  addToWaitingQueueController,
  getWaitingQueueController,
  getActiveSlotOffersController,
  respondToSlotOfferController,
  getCancellationHistoryController
} from '../controllers/slotController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/availability', checkAvailabilityController);
router.get('/venue-schedule', getVenueScheduleController);

router.get('/venues', getVenues);
router.post('/venues', authorize('ADMIN'), createVenue);
router.delete('/venues/:id', authorize('ADMIN'), deleteVenue);

router.get('/requests', getSlotRequests);
router.post('/requests', createSlotRequest);
router.put('/requests/:id/review', authorize('ADMIN'), reviewSlotRequest);
router.put('/review/:id', authorize('ADMIN'), reviewSlotRequest);

// FCFS Waiting Queue & Smart Slot Reallocation (Enhancement C)
router.get('/waiting-queue', getWaitingQueueController);
router.post('/waiting-queue', addToWaitingQueueController);
router.get('/offers', getActiveSlotOffersController);
router.post('/offers/:id/respond', respondToSlotOfferController);
router.get('/cancellations', getCancellationHistoryController);

export default router;
