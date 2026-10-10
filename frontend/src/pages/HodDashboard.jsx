import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import ActionCenter from '../components/ActionCenter';
import StatusBadge from '../components/StatusBadge';
import PDFViewerModal from '../components/PDFViewerModal';
import CreateActivityModal from '../components/CreateActivityModal';
import {
  Users, CheckSquare, Download, CheckCircle2, XCircle, AlertCircle, Plus,
  Send, RotateCcw, Clock, Eye, Calendar, MapPin, DollarSign, MessageSquare, ShieldCheck
} from 'lucide-react';

export const HodDashboard = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [pendingRequests, setPendingRequests] = useState([]);
  const [forwardedRequests, setForwardedRequests] = useState([]);
  const [deptInfo, setDeptInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPdfDeptId, setSelectedPdfDeptId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Review Dialog State
  const [activeModal, setActiveModal] = useState(null); // 'FORWARD', 'REQUEST_CHANGES', 'REJECT'
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchHodData = async () => {
    try {
      setLoading(true);
      const deptId = user?.department?._id || user?.departmentId || user?.department;
      const validDeptId = (deptId && deptId !== 'undefined' && typeof deptId === 'string') ? deptId : (user?.department?._id || null);

      const [pendingRes, forwardedRes, deptRes] = await Promise.all([
        api.get('/activities/pending-hod').catch(() => ({ success: false })),
        api.get('/activities/forwarded-hod').catch(() => ({ success: false })),
        validDeptId ? api.get(`/departments/${validDeptId}`).catch(() => ({ success: false })) : Promise.resolve({ success: false })
      ]);

      if (pendingRes && pendingRes.success) {
        setPendingRequests(pendingRes.activities || []);
      } else {
        // Fallback to general activities query filtered by department
        const actRes = await api.get('/activities').catch(() => ({ success: false }));
        if (actRes && actRes.success) {
          const all = actRes.activities || [];
          setPendingRequests(all.filter(a => ['SUBMITTED', 'HOD_REVIEW'].includes(a.status)));
          setForwardedRequests(all.filter(a => a.status === 'ADMIN_REVIEW' || a.hodForwardedBy || ['ADMIN_APPROVED', 'SCHEDULED', 'COMPLETED'].includes(a.status)));
        }
      }

      if (forwardedRes && forwardedRes.success) {
        setForwardedRequests(forwardedRes.activities || []);
      }

      if (deptRes && deptRes.success) {
        setDeptInfo(deptRes.department);
      }
    } catch (err) {
      console.error('Error fetching HOD workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHodData();
  }, [user]);

  const openActionModal = (act, actionType) => {
    setSelectedActivity(act);
    setActiveModal(actionType);
    setReviewNotes('');
  };

  const handleExecuteReview = async () => {
    if (!selectedActivity || !activeModal) return;

    if ((activeModal === 'REJECT' || activeModal === 'REQUEST_CHANGES') && !reviewNotes.trim()) {
      showToast(`A detailed explanation is mandatory to ${activeModal === 'REJECT' ? 'reject' : 'request changes'}`, 'warning');
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.put(`/activities/${selectedActivity._id}/hod-review`, {
        action: activeModal,
        notes: reviewNotes.trim()
      });

      if (res.success) {
        showToast(res.message || 'Action executed successfully', 'success');
        setActiveModal(null);
        setSelectedActivity(null);
        setReviewNotes('');
        fetchHodData();
      }
    } catch (err) {
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
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
            {user?.department?.name || deptInfo?.name || 'Department'} HOD Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Department HOD: {user?.name} ({user?.email}) • Proposal Review & Recommendation Queue
          </p>
        </div>

        <div className="flex gap-2 self-start md:self-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" /> Propose Activity
          </button>
          {(user?.department?._id || deptInfo?._id) && (
            <button
              onClick={() => setSelectedPdfDeptId(user?.department?._id || deptInfo?._id)}
              className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> Export Department PDF
            </button>
          )}
        </div>
      </div>

      {/* Action Center */}
      <ActionCenter />

      {/* SECTION 1: Pending Activity Requests (Review & Forward to Admin) */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-rcpit-600" /> Pending Activity Requests
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review proposed activities from your department and forward to Admin for final institutional approval
            </p>
          </div>
          <span className="text-xs font-bold text-rcpit-600 dark:text-rcpit-400 bg-rcpit-50 dark:bg-rcpit-950/60 border border-rcpit-200 dark:border-rcpit-800 px-3 py-1 rounded-full">
            {pendingRequests.length} Awaiting HOD Review
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading department proposals...</div>
        ) : pendingRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            No pending activity submissions currently requiring HOD review. All proposals have been reviewed or forwarded.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((act) => (
              <div
                key={act._id}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4 transition-all hover:border-rcpit-300 dark:hover:border-slate-600"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rcpit-600 dark:text-rcpit-400">
                        {act.category}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-[10px] font-bold text-slate-500">
                        Submitted: {new Date(act.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                      {act.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Submitting Coordinator: <strong className="text-slate-800 dark:text-slate-200">{act.coordinatorId?.name}</strong> ({act.coordinatorId?.designation} • {act.coordinatorId?.email})
                    </p>
                  </div>
                  <StatusBadge status={act.status} />
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 leading-relaxed">
                  {act.description}
                </p>

                {/* Proposal Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-rcpit-600 shrink-0" />
                    <span>{new Date(act.date).toLocaleDateString()} ({act.startTime} - {act.endTime})</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>Venue: {act.venueName || act.venueId?.name || 'TBD'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{act.expectedParticipants} Attendees</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Budget: ₹{act.estimatedBudget?.toLocaleString()}</span>
                  </div>
                </div>

                {/* HOD Review Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <Link
                    to={`/activities/${act._id}`}
                    className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-rcpit-600 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Full Activity Details
                  </Link>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openActionModal(act, 'REJECT')}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-colors"
                    >
                      Reject Proposal
                    </button>
                    <button
                      onClick={() => openActionModal(act, 'REQUEST_CHANGES')}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-200 dark:border-amber-800 transition-colors"
                    >
                      Request Corrections
                    </button>
                    <button
                      onClick={() => openActionModal(act, 'FORWARD')}
                      className="px-4 py-1.5 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Forward to Admin for Approval
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Forwarded Activity Requests (Tracking Queue) */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-600" /> Forwarded Activity Requests Tracker
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              History of proposals endorsed by HOD and their current stage in Admin review and institutional scheduling
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {forwardedRequests.length} Forwarded Total
          </span>
        </div>

        {forwardedRequests.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No activities have been forwarded to Admin yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Activity Title</th>
                  <th className="p-3">Coordinator</th>
                  <th className="p-3">Event Date</th>
                  <th className="p-3">Venue</th>
                  <th className="p-3">Current Status</th>
                  <th className="p-3">HOD Review Notes</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {forwardedRequests.map((act) => (
                  <tr key={act._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-extrabold text-slate-900 dark:text-white">
                      <div>{act.title}</div>
                      <span className="text-[10px] text-rcpit-600 dark:text-rcpit-400 font-bold">{act.category}</span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {act.coordinatorId?.name || 'Faculty'}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(act.date).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {act.venueName || act.venueId?.name || 'TBD'}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={act.status} size="xs" />
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {act.hodReviewNotes || '—'}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to={`/activities/${act._id}`}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors inline-block"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal: Forward, Request Changes, or Reject */}
      {activeModal && selectedActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                {activeModal === 'FORWARD' && <><Send className="w-4 h-4 text-rcpit-600" /> Forward Proposal to Admin</>}
                {activeModal === 'REQUEST_CHANGES' && <><RotateCcw className="w-4 h-4 text-amber-600" /> Request Corrections from Faculty</>}
                {activeModal === 'REJECT' && <><XCircle className="w-4 h-4 text-rose-600" /> Reject Activity Proposal</>}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                Activity: <span className="text-rcpit-600">{selectedActivity.title}</span>
              </p>
              <p className="text-slate-500">
                Coordinator: {selectedActivity.coordinatorId?.name} ({selectedActivity.coordinatorId?.email})
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                {activeModal === 'FORWARD'
                  ? 'Endorsement Notes for Admin (Optional):'
                  : activeModal === 'REQUEST_CHANGES'
                  ? 'Mandatory Correction Notes for Faculty *:'
                  : 'Mandatory Rejection Explanation Reason *:'}
              </label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={
                  activeModal === 'FORWARD'
                    ? 'e.g. Recommended for execution. Budget and syllabus alignment checked.'
                    : activeModal === 'REQUEST_CHANGES'
                    ? 'e.g. Please adjust the target audience and refine the expected learning outcomes.'
                    : 'e.g. Clashes with mid-term examinations. Please propose in next term.'
                }
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-rcpit-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReview}
                disabled={actionLoading}
                className={`px-5 py-2 font-extrabold text-xs text-white rounded-xl shadow-md disabled:opacity-50 transition-all ${
                  activeModal === 'FORWARD'
                    ? 'bg-rcpit-600 hover:bg-rcpit-500'
                    : activeModal === 'REQUEST_CHANGES'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {actionLoading ? 'Processing...' : activeModal === 'FORWARD' ? 'Confirm & Forward' : activeModal === 'REQUEST_CHANGES' ? 'Send Correction Notes' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

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
