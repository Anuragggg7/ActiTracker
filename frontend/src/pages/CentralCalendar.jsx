import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, Layers } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export const CentralCalendar = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const fetchCalendarActivities = async () => {
      try {
        setLoading(true);
        const res = await api.get('/activities');
        if (res.success) {
          setActivities(res.activities || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendarActivities();
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

  // Map activities by day number
  const activitiesByDay = {};
  activities.forEach(act => {
    const actDate = new Date(act.date);
    if (actDate.getFullYear() === year && actDate.getMonth() === month) {
      const dayNum = actDate.getDate();
      if (!activitiesByDay[dayNum]) activitiesByDay[dayNum] = [];
      activitiesByDay[dayNum].push(act);
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
            Visual month-wise activity timeline across all academic departments & institutional units
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
              <div key={`blank-${i}`} className="min-h-28 rounded-2xl bg-slate-50/40 dark:bg-slate-900/30 border border-slate-100/50 dark:border-slate-800/50 opacity-40"></div>
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayActivities = activitiesByDay[dayNum] || [];
              const isToday = new Date().getDate() === dayNum && new Date().getMonth() === month && new Date().getFullYear() === year;

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-28 p-2 rounded-2xl border transition-all flex flex-col justify-between ${
                    isToday
                      ? 'border-rcpit-500 bg-rcpit-50/40 dark:bg-rcpit-950/40 shadow-sm'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday ? 'bg-rcpit-600 text-white' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {dayNum}
                    </span>
                    {dayActivities.length > 0 && (
                      <span className="text-[10px] font-bold text-rcpit-600 dark:text-rcpit-400">
                        {dayActivities.length} event(s)
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-20 text-[10px]">
                    {dayActivities.map(act => (
                      <Link
                        key={act._id}
                        to={`/activities/${act._id}`}
                        className="block p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rcpit-50 text-slate-800 dark:text-slate-200 truncate font-semibold transition-colors"
                        title={act.title}
                      >
                        • {act.title}
                      </Link>
                    ))}
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
