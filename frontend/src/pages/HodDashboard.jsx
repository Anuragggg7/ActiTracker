import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import ActionCenter from '../components/ActionCenter';
import StatusBadge from '../components/StatusBadge';
import PDFViewerModal from '../components/PDFViewerModal';
import CreateActivityModal from '../components/CreateActivityModal';
import {
  Users, CheckSquare, Download, CheckCircle2, XCircle, AlertCircle, Plus
} from 'lucide-react';

export const HodDashboard = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [pendingEvents, setPendingEvents] = useState([]);
  const [departmentActivities, setDepartmentActivities] = useState([]);
  const [deptInfo, setDeptInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPdfDeptId, setSelectedPdfDeptId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchHodData = async () => {
    try {
      const deptId = user?.department?._id || user?.departmentId || user?.department;
      const validDeptId = (deptId && deptId !== 'undefined' && typeof deptId === 'string') ? deptId : (user?.department?._id || null);

      const [actRes, deptRes] = await Promise.all([
        api.get('/activities'),
        validDeptId ? api.get(`/departments/${validDeptId}`) : Promise.resolve({ success: false })
      ]);

      if (actRes.success) {
        const allActs = actRes.activities || [];
        setDepartmentActivities(allActs);
        setPendingEvents(allActs.filter(a => a.status === 'SUBMITTED'));
      }
      if (deptRes.success) setDeptInfo(deptRes.department);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHodData();
  }, [user]);

  const handleReviewActivity = async (activityId, action, notes = '') => {
    try {
      const res = await api.put(`/activities/${activityId}/hod-review`, { action, notes });
      if (res.success) {
        showToast(res.message, 'success');
        fetchHodData();
      }
    } catch (err) {
      showToast(err.message || 'Action failed', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-rcpit-950 via-rcpit-900 to-rcpit-800 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300 bg-cyan-950/80 px-3 py-1 rounded-full border border-cyan-800">
            Head of Department Workspace
          </span>
          <h1 className="text-2xl font-extrabold mt-2">
            {user?.department?.name || 'Department'} HOD Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Department HOD: {user?.name} ({user?.email})
          </p>
        </div>

        <div className="flex gap-2 self-start md:self-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Activity
          </button>
          {user?.department?._id && (
            <button
              onClick={() => setSelectedPdfDeptId(user.department._id)}
              className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> Export Department PDF
            </button>
          )}
        </div>
      </div>

      {/* Action Center */}
      <ActionCenter />

      {/* Main Section: Pending Event Approvals */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <span className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-rcpit-600" /> Pending Department Event Approvals
          </span>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {pendingEvents.length} Pending
          </span>
        </h3>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading department events...</div>
        ) : pendingEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No pending event submissions requiring HOD review.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingEvents.map((act) => (
              <div
                key={act._id}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rcpit-600 dark:text-rcpit-400">
                      {act.category}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {act.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Coordinator: {act.coordinatorId?.name} ({act.coordinatorId?.email})
                    </p>
                  </div>
                  <StatusBadge status={act.status} />
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  {act.description}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>
                    Date: {new Date(act.date).toLocaleDateString()} ({act.startTime} - {act.endTime})
                  </span>
                  <div className="space-x-2">
                    <button
                      onClick={() => handleReviewActivity(act._id, 'REJECT')}
                      className="px-3 py-1.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold rounded-xl"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleReviewActivity(act._id, 'APPROVE')}
                      className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-xl shadow-sm"
                    >
                      Approve & Forward for Slot
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Modal */}
      <PDFViewerModal
        isOpen={!!selectedPdfDeptId}
        onClose={() => setSelectedPdfDeptId(null)}
        activityId={selectedPdfDeptId}
        pdfType="department"
      />

      {/* Activity Creation Modal */}
      <CreateActivityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchHodData}
      />
    </div>
  );
};

export default HodDashboard;
