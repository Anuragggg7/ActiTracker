import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin, Clock, Filter, Sun, XCircle } from 'lucide-react';

export const CentralCalendar = () => {
  const [activities, setActivities] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterVenue, setFilterVenue] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, ACTIVE, CANCELLED

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [actRes, venueRes] = await Promise.all([
          api.get('/activities'),
          api.get('/venues')
        ]);
        if (actRes.success) {
          setActivities(actRes.activities || []);
        }
        if (venueRes.success) {
          setVenues(venueRes.venues || []);
        }
      } catch (err) {
        console.error('Failed to load calendar activities', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Map activities & multi-sessions by day number
  const activitiesByDay = {};

  activities.forEach(act => {
    // Filter status
    const isActCancelled = act.status === 'CANCELLED';
    if (filterStatus === 'ACTIVE' && isActCancelled) return;
    if (filterStatus === 'CANCELLED' && !isActCancelled) return;

    if (act.sessions && act.sessions.length > 0) {
      act.sessions.forEach(sess => {
        const isSessCancelled = sess.status === 'CANCELLED' || isActCancelled;
        if (filterStatus === 'ACTIVE' && isSessCancelled) return;
        if (filterStatus === 'CANCELLED' && !isSessCancelled) return;

        const sessVenueId = sess.venueId?._id || sess.venueId || act.venueId?._id || act.venueId;
        if (filterVenue !== 'ALL' && sessVenueId !== filterVenue) return;

        const sessDate = new Date(sess.date);
        if (sessDate.getFullYear() === year && sessDate.getMonth() === month) {
          const dayNum = sessDate.getDate();
          if (!activitiesByDay[dayNum]) activitiesByDay[dayNum] = [];
          activitiesByDay[dayNum].push({
            _id: act._id,
            uniqueKey: `${act._id}-${sess._id || sess.sessionNumber}`,
            title: act.title,
            displayTitle: `${act.title} (Sess ${sess.sessionNumber || 1})`,
            displayTime: sess.isAllDay ? 'All-Day' : `${sess.startTime} - ${sess.endTime}`,
            venueName: sess.venueName || sess.venueId?.name || act.venueName || 'Venue TBD',
            isAllDay: Boolean(sess.isAllDay || act.isAllDay),
            status: isSessCancelled ? 'CANCELLED' : (sess.status || act.status),
            department: act.departmentId?.name || act.departmentName
          });
        }
      });
    } else {
      const actVenueId = act.venueId?._id || act.venueId;
      if (filterVenue !== 'ALL' && actVenueId !== filterVenue) return;

      const actDate = new Date(act.date);
      if (actDate.getFullYear() === year && actDate.getMonth() === month) {
        const dayNum = actDate.getDate();
        if (!activitiesByDay[dayNum]) activitiesByDay[dayNum] = [];
        activitiesByDay[dayNum].push({
          _id: act._id,
          uniqueKey: act._id,
          title: act.title,
          displayTitle: act.title,
          displayTime: act.isAllDay ? 'All-Day (06:00 - 22:00)' : `${act.startTime} - ${act.endTime}`,
          venueName: act.venueName || act.venueId?.name || 'Venue TBD',
          isAllDay: Boolean(act.isAllDay),
          status: act.status,
          department: act.departmentId?.name || act.departmentName
        });
      }
    }
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-rcpit-900 via-rcpit-800 to-rcpit-950 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rcpit-400 bg-rcpit-950/80 px-3 py-1 rounded-full border border-rcpit-800">
            Institutional Master Schedule
          </span>
          <h1 className="text-2xl font-extrabold mt-2 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-rcpit-400" /> Central Institutional Calendar
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Visual month-wise activity timeline, multi-session schedules, all-day reservations & real-time slot statuses
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 p-2 rounded-2xl border border-white/10 self-start sm:self-auto">
          <button onClick={prevMonth} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-extrabold text-sm min-w-32 text-center">
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4 text-rcpit-600" /> Filters:
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-500">Venue:</label>
            <select
              value={filterVenue}
              onChange={(e) => setFilterVenue(e.target.value)}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              <option value="ALL">All Venues</option>
              {venues.map(v => (
                <option key={v._id} value={v._id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-500">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              <option value="ALL">All Activities</option>
              <option value="ACTIVE">Active / Confirmed Only</option>
              <option value="CANCELLED">Cancelled Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Confirmed
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> All-Day
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Cancelled
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass-card p-6 space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading master schedule...</div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="p-2 text-center font-extrabold text-xs uppercase text-slate-400">
                {d}
              </div>
            ))}

            {/* Blank offset cells */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-32 rounded-2xl bg-slate-50/40 dark:bg-slate-900/30 border border-slate-100/50 dark:border-slate-800/50 opacity-40"></div>
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayActivities = activitiesByDay[dayNum] || [];
              const isToday = new Date().getDate() === dayNum && new Date().getMonth() === month && new Date().getFullYear() === year;

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-32 p-2 rounded-2xl border transition-all flex flex-col justify-between ${
                    isToday
                      ? 'border-rcpit-500 bg-rcpit-50/40 dark:bg-rcpit-950/40 shadow-sm ring-1 ring-rcpit-500/30'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday ? 'bg-rcpit-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {dayNum}
                    </span>
                    {dayActivities.length > 0 && (
                      <span className="text-[10px] font-bold text-rcpit-600 dark:text-rcpit-400">
                        {dayActivities.length} item{dayActivities.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 overflow-y-auto max-h-24 text-[10px]">
                    {dayActivities.map(act => {
                      const isCancelled = act.status === 'CANCELLED';
                      return (
                        <Link
                          key={act.uniqueKey}
                          to={`/activities/${act._id}`}
                          className={`block p-1.5 rounded-lg border transition-all ${
                            isCancelled
                              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 opacity-70 line-through'
                              : act.isAllDay
                              ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:border-amber-400'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-rcpit-500 text-slate-800 dark:text-slate-200'
                          }`}
                          title={`${act.displayTitle} | ${act.displayTime} | ${act.venueName}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate font-bold">
                              {act.displayTitle}
                            </span>
                            {act.isAllDay && (
                              <span className="shrink-0 px-1 py-0.2 bg-amber-500 text-slate-950 rounded text-[8px] font-black uppercase">
                                All-Day
                              </span>
                            )}
                            {isCancelled && (
                              <span className="shrink-0 text-rose-600 dark:text-rose-400">
                                <XCircle className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 no-underline font-normal">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{act.displayTime}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400 no-underline font-normal">
                            <MapPin className="w-2.5 h-2.5 shrink-0 text-rcpit-500" />
                            <span className="truncate">{act.venueName}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default CentralCalendar;
