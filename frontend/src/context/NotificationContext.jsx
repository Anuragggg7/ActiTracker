import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, [user]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, fetchNotifications, markAllRead, showToast }}>
      {children}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-5 py-3 rounded-lg shadow-xl text-white font-medium flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600' :
            toast.type === 'error' ? 'bg-rose-600' :
            toast.type === 'warning' ? 'bg-amber-600' : 'bg-rcpit-600'
          }`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
