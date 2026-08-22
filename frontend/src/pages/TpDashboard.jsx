import React, { useState, useEffect } from 'react';
import api from '../api/client';
import ActionCenter from '../components/ActionCenter';
import StatusBadge from '../components/StatusBadge';
import CreateActivityModal from '../components/CreateActivityModal';
import { Briefcase, Calendar, Plus, Users, Award, FileText } from 'lucide-react';

export const TpDashboard = () => {
  const [tpActivities, setTpActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchTp = async () => {
    try {
      setLoading(true);
      const res = await api.get('/activities');
      if (res.success) {
        setTpActivities((res.activities || []).filter(a =>
          ['Placement Drive', 'Training', 'Industry Interaction', 'Industrial Visit'].includes(a.category) ||
          a.departmentId?.code === 'TP'
        ));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTp();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-300 bg-purple-950/80 px-3 py-1 rounded-full border border-purple-800">
            Training & Placement Cell Portal
          </span>
          <h1 className="text-2xl font-extrabold mt-2">
            Training & Placement Management Dashboard
          </h1>
          <p className="text-xs text-purple-200 mt-1">
            Managing recruitment drives, internships, training programs, and industry interactions
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 self-start md:self-auto transition-all"
        >
          <Plus className="w-4 h-4" /> Create T&P Activity (Photos/Videos)
        </button>
      </div>

      <ActionCenter />

      {/* Activities Grid */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-purple-600" /> T&P Drives & Training Programs
        </h3>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading T&P drives...</div>
        ) : tpActivities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">No active T&P drives recorded.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tpActivities.map((act) => (
              <div key={act._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">{act.category}</span>
                  <StatusBadge status={act.status} />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{act.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-2">{act.description}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>{new Date(act.date).toLocaleDateString()}</span>
                  <span>Venue: {act.venueName || 'TBD'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateActivityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchTp}
      />

    </div>
  );
};

export default TpDashboard;
