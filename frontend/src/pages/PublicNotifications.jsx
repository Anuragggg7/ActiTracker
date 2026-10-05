import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import RcpitLogo from '../components/RcpitLogo';
import { Bell, Calendar, ArrowLeft, ExternalLink, ShieldCheck, Megaphone } from 'lucide-react';

export const PublicNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicNotifications = async () => {
      try {
        setLoading(true);
        const res = await api.get('/notifications/public');
        if (res.success) {
          setNotifications(res.notifications || []);
        }
      } catch (err) {
        console.error('Failed to fetch public notifications:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicNotifications();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="hover:opacity-95 transition-opacity">
            <RcpitLogo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 bg-rcpit-600 hover:bg-rcpit-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Portal Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
        {/* Banner */}
        <div className="p-8 rounded-3xl bg-gradient-to-r from-rcpit-900 via-rcpit-800 to-rcpit-950 text-white shadow-xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rcpit-950/80 border border-rcpit-800 text-[10px] font-extrabold uppercase tracking-widest text-rcpit-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Official Institutional Circulars & Notices
          </div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">
            R. C. Patel Institute of Technology — Public Announcements
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Public activity notices, open campus event invitations, and official institutional announcements published by RCPIT Departments and Administration.
          </p>
        </div>

        {/* Notice List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-rcpit-600" /> Public Notifications ({notifications.length})
            </h2>
            <span className="text-xs text-slate-400 font-semibold">
              Updated Live from MongoDB
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs font-bold text-slate-400">
              Loading public announcements...
            </div>
          ) : notifications.length === 0 ? (
            <div className="glass-card p-12 text-center space-y-3">
              <Bell className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-500">
                No public notifications broadcasted at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n._id}
                  className="glass-card p-5 space-y-2 border-l-4 border-rcpit-600 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rcpit-50 text-rcpit-600 dark:bg-rcpit-950 dark:text-rcpit-400 border border-rcpit-200 dark:border-rcpit-800">
                      {n.category || 'Public Announcement'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(n.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {n.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {n.message}
                  </p>

                  {n.link && (
                    <div className="pt-2">
                      <Link
                        to={n.link}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rcpit-600 hover:underline"
                      >
                        View Event Details <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-slate-800 text-center text-xs font-medium text-slate-500">
        © 2026 R. C. Patel Institute of Technology, Shirpur. ActiTracker Institutional System.
      </footer>
    </div>
  );
};

export default PublicNotifications;
