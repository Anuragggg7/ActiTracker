import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { Bell, ArrowLeft, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export const NotificationsView = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead } = useNotifications();

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Top Header Navigation Bar with PROMINENT "Go Back" Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-200 shadow-sm hover:border-rcpit-500 hover:text-rcpit-600 transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-rcpit-600" /> Go Back to Dashboard
        </button>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="px-4 py-2.5 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs rounded-2xl shadow transition-all flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" /> Mark All as Read
          </button>
        )}
      </div>

      {/* Main Notification Card */}
      <div className="glass-card p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rcpit-50 dark:bg-slate-800 text-rcpit-600">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Institutional Notifications & Alerts
              </h1>
              <p className="text-xs text-slate-400">
                Real-time activity approvals, slot confirmations, and faculty registrations
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-extrabold">
            {unreadCount} Unread
          </span>
        </div>

        {/* Notifications Listing */}
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <p>No notifications found.</p>
              <button
                onClick={() => navigate(-1)}
                className="text-rcpit-600 font-bold hover:underline"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                className={`p-4 rounded-2xl text-xs transition-all flex items-start justify-between gap-4 border ${
                  n.isRead
                    ? 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    : 'bg-rcpit-50/80 dark:bg-rcpit-950/40 border-rcpit-200 dark:border-rcpit-800 text-slate-900 dark:text-white font-medium shadow-xs'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm">{n.title}</span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-rcpit-600 animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{n.message}</p>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                    <Clock className="w-3 h-3" /> {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>

                {n.link && (
                  <button
                    onClick={() => navigate(n.link)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-extrabold text-[11px] hover:border-rcpit-500 shrink-0"
                  >
                    View Details
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default NotificationsView;
