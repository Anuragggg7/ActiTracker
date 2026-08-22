import Notification from '../models/Notification.js';

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user._id })
      .populate('senderId', 'name role')
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({ recipientId: req.user._id, isRead: false });

    res.json({ success: true, count: notifications.length, unreadCount, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipientId: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
