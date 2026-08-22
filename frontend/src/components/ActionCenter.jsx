import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

export const ActionCenter = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActionItems = async () => {
      try {
        const res = await api.get('/analytics/action-center');
        if (res.success) {
          setItems(res.items || []);
        }
      } catch (err) {
        console.error('Failed to fetch action center items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActionItems();
  }, []);

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
          <div className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200 dark:border-amber-900/40 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              WHAT REQUIRES MY ATTENTION?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pending action items requiring your approval or resolution
            </p>
          </div>
        </div>
        <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold text-xs rounded-full border border-amber-300 dark:border-amber-800">
          {items.length} Pending
        </span>
      </div>

      {items.length === 0 ? (
        <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-xs font-semibold">
            All clear! You have zero pending tasks requiring action.
          </span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.link}
              className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 shadow-2xs hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${
                  item.priority === 'URGENT' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400' :
                  item.priority === 'HIGH' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' :
                  'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                }`}>
                  {item.priority === 'URGENT' ? <ShieldAlert className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {item.title}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                <span>Resolve</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionCenter;
