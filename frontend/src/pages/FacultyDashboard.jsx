import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import ActionCenter from '../components/ActionCenter';
import StatusBadge from '../components/StatusBadge';
import QRCodeModal from '../components/QRCodeModal';
import PDFViewerModal from '../components/PDFViewerModal';
import CreateActivityModal from '../components/CreateActivityModal';
import ResubmitActivityModal from '../components/ResubmitActivityModal';
import {
  Plus, Calendar, CheckSquare, Clock, FileText, QrCode, Download,
  Layers, Search, AlertCircle, ArrowRight, Eye, XCircle, CheckCircle2,
  Bell, AlertTriangle, ShieldCheck, X, Sparkles, MapPin, RotateCcw,
  Archive, Edit3, ChevronRight, MessageSquare
} from 'lucide-react';

export const FacultyDashboard = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [activities, setActivities] = useState([]);
  const [slotOffers, setSlotOffers] = useState([]);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [changesRequestedActivities, setChangesRequestedActivities] = useState([]);
  const [rejectedActivities, setRejectedActivities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedQrActivity, setSelectedQrActivity] = useState(null);
  const [selectedPdfActivityId, setSelectedPdfActivityId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedResubmitActivity, setSelectedResubmitActivity] = useState(null);

  // Cancellation Modal State (Enhancement C)
  const [cancellingActivity, setCancellingActivity] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedCancelSessionId, setSelectedCancelSessionId] = useState('');
  const [cancellingLoading, setCancellingLoading] = useState(false);

  // Offer Action State
  const [offerActionLoading, setOfferActionLoading] = useState(false);

  const filteredActivities = activities.filter(act => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      act.title?.toLowerCase().includes(term) ||
      act.category?.toLowerCase().includes(term) ||
      act.venueName?.toLowerCase().includes(term) ||
      act.status?.toLowerCase().includes(term)
    );
  });

  const fetchFacultyData = async () => {
    try {
      setLoading(true);
      const [actRes, offersRes, queueRes, changesRes, rejectedRes] = await Promise.all([
        api.get('/activities').catch(() => ({ success: false })),
        api.get('/slots/offers').catch(() => ({ success: false })),
        api.get('/slots/waiting-queue').catch(() => ({ success: false })),
        api.get('/activities/changes-requested').catch(() => ({ success: false })),
        api.get('/activities/rejected').catch(() => ({ success: false }))
      ]);

      if (actRes && actRes.success) {
        setActivities(actRes.activities || []);
      }
      if (offersRes && offersRes.success) {
        setSlotOffers(offersRes.offers || []);
      }
      if (queueRes && queueRes.success) {
        setWaitingQueue(queueRes.waitingQueue || []);
      }
      if (changesRes && changesRes.success) {
        setChangesRequestedActivities(changesRes.activities || []);
      }
      if (rejectedRes && rejectedRes.success) {
        setRejectedActivities(rejectedRes.activities || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyData();
  }, []);

  // Smooth scroll to target activity if opened with hash (e.g., from Action Center)
  useEffect(() => {
    if (!loading && window.location.hash) {
      const targetId = window.location.hash.replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-4', 'ring-amber-500', 'ring-offset-2', 'transition-all', 'duration-500');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-amber-500', 'ring-offset-2');
          }, 3000);
        }, 200);
      }
    }
  }, [loading]);

  // Handle Activity or Session Cancellation
  const handleConfirmCancellation = async () => {
    if (!cancellingActivity) return;
    if (!cancelReason.trim()) {
      showToast('A cancellation explanation reason is mandatory', 'warning');
      return;
    }

    try {
      setCancellingLoading(true);
      const res = await api.post(`/activities/${cancellingActivity._id}/cancel`, {
        reason: cancelReason.trim(),
        sessionId: selectedCancelSessionId || undefined
      });

      if (res.success) {
        showToast(res.message || 'Booking cancelled and slot released successfully', 'success');
        setCancellingActivity(null);
        setCancelReason('');
        setSelectedCancelSessionId('');
        fetchFacultyData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to cancel activity', 'error');
    } finally {
      setCancellingLoading(false);
    }
  };

  // Handle Slot Offer Response (ACCEPT or DECLINE)
  const handleRespondToOffer = async (offerId, action) => {
    try {
      setOfferActionLoading(true);
      const res = await api.post(`/slots/offers/${offerId}/respond`, { action });
      if (res.success) {
        showToast(res.message, 'success');
        fetchFacultyData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to respond to offer', 'error');
    } finally {
      setOfferActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-rcpit-900 via-rcpit-800 to-rcpit-950 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rcpit-400 bg-rcpit-950/80 px-3 py-1 rounded-full border border-rcpit-800">
            Faculty Workspace Portal
          </span>
          <h1 className="text-2xl font-extrabold mt-2">
            Welcome back, {user?.name}!
          </h1>
          <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
            <span>{user?.designation} • {user?.department?.name || 'Department'}</span>
            {user?.facultyEmployeeId && (
              <span className="bg-emerald-950/80 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-700 font-mono font-bold text-[11px] flex items-center gap-1">
                🪪 Faculty ID: {user.facultyEmployeeId} (VERIFIED)
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-3 bg-rcpit-500 hover:bg-rcpit-400 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 self-start md:self-auto transition-all"
        >
          <Plus className="w-4 h-4" /> Create New Activity
        </button>
      </div>

      {/* ACTIVE SLOT OFFERS BANNER (Enhancement C) */}
      {slotOffers.length > 0 && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-emerald-600/15 to-emerald-500/10 border-2 border-emerald-500/40 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              Smart Slot Reallocation Alert: Released Venue Slot Available!
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            A previously booked venue slot has been released and offered to you through the FCFS waiting queue. Please accept to confirm your booking or decline to pass it to the next requester.
          </p>

          <div className="space-y-2">
            {slotOffers.map((offer) => (
              <div
                key={offer._id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                    {offer.activityId?.title || 'Your Queued Activity'}
                  </h4>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 font-bold text-emerald-600">
                      <MapPin className="w-3.5 h-3.5" /> {offer.venueId?.name || 'Assigned Venue'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> {new Date(offer.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {offer.isAllDay ? 'All-Day' : `${offer.startTime} - ${offer.endTime}`}
                    </span>
                    <span className="text-rose-500 font-bold text-[10px]">
                      Expires: {new Date(offer.expiresAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={offerActionLoading}
                    onClick={() => handleRespondToOffer(offer._id, 'DECLINE')}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={offerActionLoading}
                    onClick={() => handleRespondToOffer(offer._id, 'ACCEPT')}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Schedule Slot
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CHANGES REQUESTED SECTION (Change 3) */}
      {changesRequestedActivities.length > 0 && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/40 shadow-xl space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-800/60 pb-3">
            <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider">
                  Changes Requested by Reviewing Authority ({changesRequestedActivities.length})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Review the feedback instructions below, apply necessary corrections, and resubmit for approval.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold text-[11px] border border-amber-300 dark:border-amber-700 self-start sm:self-auto">
              Action Required
            </span>
          </div>

          <div className="space-y-3">
            {changesRequestedActivities.map((act) => {
              const latestCR = act.changeRequests?.slice()?.reverse()?.find(cr => cr.status === 'PENDING') 
                || act.changeRequests?.[act.changeRequests?.length - 1];
              const reviewerName = latestCR?.requestedBy?.name || (act.hodReviewNotes ? 'Department HOD' : 'Institutional Admin');
              const reviewerRole = latestCR?.requestedByRole || (act.hodReviewNotes ? 'HOD' : 'ADMIN');
              const instructions = latestCR?.instructions || act.adminReviewNotes || act.hodReviewNotes || 'Please review and modify activity details.';
              const requestDate = latestCR?.requestedAt ? new Date(latestCR.requestedAt).toLocaleString() : new Date(act.updatedAt).toLocaleString();

              return (
                <div
                  key={act._id}
                  id={`activity-${act._id}`}
                  className="scroll-mt-24 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">
                        {act.title}
                      </h4>
                      <StatusBadge status={act.status} />
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                        Requested by: {reviewerName} ({reviewerRole})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        • {requestDate}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs">
                      <span className="font-extrabold text-amber-900 dark:text-amber-300 block mb-1 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" /> Reviewer Feedback & Instructions:
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line font-medium leading-relaxed">
                        "{instructions}"
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span><strong>Venue:</strong> {act.venueName || act.venueId?.name || 'TBD'}</span>
                      <span>•</span>
                      <span><strong>Date:</strong> {new Date(act.date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span><strong>Time:</strong> {act.isAllDay ? 'All-Day' : `${act.startTime} - ${act.endTime}`}</span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedResubmitActivity(act)}
                      className="w-full px-4 py-2.5 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Update & Resubmit Activity
                    </button>
                    <Link
                      to={`/faculty/activities/${act._id}`}
                      className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all text-center"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Center Widget */}
      <ActionCenter />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Active</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{activities.length}</p>
        </div>
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-amber-600 font-bold uppercase tracking-wider">Pending Approvals</span>
          <p className="text-2xl font-black text-amber-600">
            {activities.filter(a => ['SUBMITTED', 'HOD_REVIEW', 'ADMIN_REVIEW', 'SLOT_REQUESTED'].includes(a.status)).length}
          </p>
        </div>
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-rose-600 font-bold uppercase tracking-wider">Changes Required</span>
          <p className="text-2xl font-black text-rose-600">
            {changesRequestedActivities.length}
          </p>
        </div>
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-sky-600 font-bold uppercase tracking-wider">Scheduled Events</span>
          <p className="text-2xl font-black text-sky-600">
            {activities.filter(a => a.status === 'SCHEDULED').length}
          </p>
        </div>
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Rejected Archive</span>
          <p className="text-2xl font-black text-slate-600 dark:text-slate-400">
            {rejectedActivities.length}
          </p>
        </div>
      </div>

      {/* Activities Table */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-rcpit-600" /> My Activity Lifecycle Records
          </h3>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search activities, venue, category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-rcpit-500"
              />
            </div>
            <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
              Showing {filteredActivities.length} of {activities.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading activities...</div>
        ) : activities.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <p>No activities recorded yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-rcpit-600 font-bold hover:underline"
            >
              Click here to create your first institutional activity
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="pb-3 px-2">Activity Title</th>
                  <th className="pb-3 px-2">Category</th>
                  <th className="pb-3 px-2">Schedule & Venue</th>
                  <th className="pb-3 px-2">Lifecycle Status</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredActivities.map((act) => {
                  const isEligibleForCancellation =
                    !['COMPLETED', 'ARCHIVED', 'CANCELLED'].includes(act.status);

                  return (
                    <tr key={act._id} id={`activity-${act._id}`} className="scroll-mt-24 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-2 font-bold text-slate-900 dark:text-white max-w-xs">
                        <Link
                          to={`/faculty/activities/${act._id}`}
                          className="hover:text-rcpit-600 dark:hover:text-rcpit-400 hover:underline transition-colors block truncate cursor-pointer"
                          title={act.title}
                        >
                          {act.title}
                        </Link>
                        {act.rejectionReason && ['REJECTED', 'CHANGES_REQUIRED'].includes(act.status) && (
                          <span className="text-[10px] text-rose-500 font-semibold block truncate mt-0.5" title={act.rejectionReason}>
                            ⚠️ Reason: {act.rejectionReason}
                          </span>
                        )}
                        {act.status === 'CANCELLED' && act.cancellationReason && (
                          <span className="text-[10px] text-slate-400 block truncate mt-0.5" title={act.cancellationReason}>
                            Cancelled: {act.cancellationReason}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400">
                        {act.category}
                      </td>
                      <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span>{new Date(act.date).toLocaleDateString()}</span>
                          {act.isAllDay ? (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase">
                              All-Day
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              ({act.startTime} - {act.endTime})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {act.venueName || 'TBD'}
                          {Array.isArray(act.sessions) && act.sessions.length > 1 && (
                            <span className="text-rcpit-600 font-bold ml-1">
                              • {act.sessions.length} sessions
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <StatusBadge status={act.status} />
                      </td>
                      <td className="py-3.5 px-2 text-right space-x-1">
                        <Link
                          to={`/faculty/activities/${act._id}`}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rcpit-50 text-slate-600 dark:text-slate-300 inline-flex items-center"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>

                        {/* Cancellation Action for Eligible Bookings (Enhancement C) */}
                        {isEligibleForCancellation && (
                          <button
                            onClick={() => {
                              setCancellingActivity(act);
                              setCancelReason('');
                              setSelectedCancelSessionId('');
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-400 inline-flex items-center transition-colors"
                            title="Cancel Booking & Release Slot"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {['ADMIN_APPROVED', 'SCHEDULED', 'COMPLETED', 'ARCHIVED'].includes(act.status) && (
                          <>
                            <button
                              onClick={() => setSelectedQrActivity(act)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rcpit-50 text-slate-600 dark:text-slate-300 inline-flex items-center"
                              title="Show Verification QR Code"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedPdfActivityId(act._id)}
                              className="p-1.5 rounded-lg bg-rcpit-50 text-rcpit-600 dark:bg-rcpit-950 dark:text-rcpit-400 font-bold inline-flex items-center"
                              title="Generate Event PDF Report"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REJECTED ACTIVITIES / ARCHIVE (Change 4) */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-500" />
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Rejected Activities / Archive
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  {rejectedActivities.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Archived records automatically removed from active booking workflows and scheduling queues.
              </p>
            </div>
          </div>
        </div>

        {rejectedActivities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No rejected or archived activity proposals found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="pb-3 px-2">Activity Title</th>
                  <th className="pb-3 px-2">Category</th>
                  <th className="pb-3 px-2">Rejection Reason</th>
                  <th className="pb-3 px-2">Rejected By</th>
                  <th className="pb-3 px-2">Rejection Date</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rejectedActivities.map((act) => {
                  const rejectorName = act.rejectedBy?.name || (act.adminReviewNotes ? 'Admin Reviewer' : 'Department HOD');
                  const rejectorRole = act.rejectedBy?.role || (act.adminReviewNotes ? 'ADMIN' : 'HOD');
                  const reason = act.rejectionReason || act.adminReviewNotes || act.hodReviewNotes || 'Institutional proposal criteria not satisfied.';
                  const rejectDate = act.rejectedAt ? new Date(act.rejectedAt).toLocaleDateString() : new Date(act.updatedAt).toLocaleDateString();

                  return (
                    <tr key={act._id} id={`activity-${act._id}`} className="scroll-mt-24 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-colors">
                      <td className="py-3.5 px-2 font-bold text-slate-900 dark:text-white max-w-xs">
                        <Link
                          to={`/faculty/activities/${act._id}`}
                          className="hover:text-rose-600 dark:hover:text-rose-400 hover:underline transition-colors block truncate"
                          title={act.title}
                        >
                          {act.title}
                        </Link>
                        <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                          {act.venueName || 'Venue TBD'} • {new Date(act.date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400">
                        {act.category}
                      </td>
                      <td className="py-3.5 px-2 max-w-xs">
                        <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300 font-medium line-clamp-2" title={reason}>
                          {reason}
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">
                          {rejectorName}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          {rejectorRole}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-500 text-xs">
                        {rejectDate}
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <Link
                          to={`/faculty/activities/${act._id}`}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ACTIVITY CANCELLATION MODAL (Enhancement C) */}
      {cancellingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-rose-600 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" /> Cancel Activity Booking
              </h3>
              <button
                onClick={() => setCancellingActivity(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p className="font-bold text-slate-900 dark:text-white">
                Activity: <span className="text-rcpit-600">{cancellingActivity.title}</span>
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 space-y-1">
                <p><strong>Venue:</strong> {cancellingActivity.venueName || 'Assigned Venue'}</p>
                <p><strong>Date & Time:</strong> {new Date(cancellingActivity.date).toLocaleDateString()} ({cancellingActivity.isAllDay ? 'All-Day' : `${cancellingActivity.startTime} - ${cancellingActivity.endTime}`})</p>
              </div>

              {/* Multi-Session Cancellation Selector */}
              {Array.isArray(cancellingActivity.sessions) && cancellingActivity.sessions.length > 1 && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cancellation Scope:
                  </label>
                  <select
                    value={selectedCancelSessionId}
                    onChange={(e) => setSelectedCancelSessionId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="">Cancel Entire Activity (All Sessions)</option>
                    {cancellingActivity.sessions.map((s, idx) => (
                      <option key={s._id || idx} value={s._id} disabled={s.status === 'CANCELLED'}>
                        Cancel Session: {s.sessionTitle || `Session ${idx + 1}`} ({new Date(s.date).toLocaleDateString()}) {s.status === 'CANCELLED' ? '[Already Cancelled]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Notice:</strong> Confirming cancellation will immediately release your reserved venue slot. The slot will be automatically reallocated to the next eligible requester in the FCFS waiting queue.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cancellation Reason <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Guest speaker flight cancelled, event postponed to next academic term..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCancellingActivity(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={cancellingLoading}
                onClick={handleConfirmCancellation}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {cancellingLoading ? 'Releasing Slot...' : 'Confirm Cancellation & Release Slot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR & PDF Modals */}
      <QRCodeModal
        isOpen={!!selectedQrActivity}
        onClose={() => setSelectedQrActivity(null)}
        activity={selectedQrActivity}
      />
      <PDFViewerModal
        isOpen={!!selectedPdfActivityId}
        onClose={() => setSelectedPdfActivityId(null)}
        activityId={selectedPdfActivityId}
      />

      {/* Activity Creation Modal */}
      <CreateActivityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchFacultyData}
      />

      {/* Activity Resubmission Modal (Change 3) */}
      <ResubmitActivityModal
        isOpen={!!selectedResubmitActivity}
        onClose={() => setSelectedResubmitActivity(null)}
        activity={selectedResubmitActivity}
        onSuccess={() => {
          setSelectedResubmitActivity(null);
          fetchFacultyData();
        }}
      />

    </div>
  );
};

export default FacultyDashboard;
