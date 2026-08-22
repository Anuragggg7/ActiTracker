import express from 'express';
import { getMyNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getMyNotifications);
router.put('/:id/read', markNotificationAsRead);
router.put('/read-all', markAllNotificationsAsRead);

export default router;
