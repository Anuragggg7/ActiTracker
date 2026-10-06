import express from 'express';
import {
  checkAvailabilityController,
  getVenueScheduleController,
  createSlotRequest,
  reviewSlotRequest,
  getSlotRequests,
  getVenues,
  createVenue,
  deleteVenue
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

export default router;
