import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import ActionCenter from '../components/ActionCenter';
import StatusBadge from '../components/StatusBadge';
import { useNotifications } from '../context/NotificationContext';
import { fetchDepartmentsWithFallback } from '../utils/departments';
import CreateActivityModal from '../components/CreateActivityModal';
import {
  Users, Building, Clock, ShieldAlert, Plus, AlertTriangle, CheckCircle, XCircle,
  Search, RefreshCw, Eye, EyeOff, CheckSquare, Send, RotateCcw, Calendar, MapPin,
  DollarSign, MessageSquare, Filter, ShieldCheck
} from 'lucide-react';

export const AdminDashboard = () => {
  const { showToast } = useNotifications();
  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals', 'slots', 'users', 'departments', 'audit'

  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [allApprovalsHistory, setAllApprovalsHistory] = useState([]);
  const [slotRequests, setSlotRequests] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Approval Center Filters & Search
  const [approvalSearch, setApprovalSearch] = useState('');
  const [approvalDeptFilter, setApprovalDeptFilter] = useState('');
  const [approvalCategoryFilter, setApprovalCategoryFilter] = useState('');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('ADMIN_REVIEW');

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState(null); // 'APPROVE', 'REJECT', 'REQUEST_CHANGES'
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);

  // User Creation Form Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '', email: '', password: '', role: 'HOD', departmentId: '', employeeId: '', designation: ''
  });

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [pendingActRes, allActRes, slotRes, userRes, deptsList, auditRes] = await Promise.all([
        api.get('/activities/pending-admin').catch((err) => {
          console.warn('Pending admin activities fetch error:', err.message);
          return { success: false };
        }),
        api.get('/activities').catch((err) => {
          console.warn('All activities fetch error:', err.message);
          return { success: false };
        }),
        api.get('/slots/requests').catch((err) => {
          console.warn('Slot requests fetch error:', err.message);
          return { success: false };
        }),
        api.get('/users').catch((err) => {
          console.warn('Users fetch error:', err.message);
          return { success: false };
        }),
        fetchDepartmentsWithFallback(),
        api.get('/audit-logs').catch((err) => {
          console.warn('Audit logs fetch error:', err.message);
          return { success: false };
        })
      ]);

      if (pendingActRes && pendingActRes.success) {
        setPendingApprovals(pendingActRes.activities || []);
      }

      if (allActRes && allActRes.success) {
        const acts = allActRes.activities || [];
        setAllApprovalsHistory(acts);
        if (!pendingActRes?.success) {
          setPendingApprovals(acts.filter(a => a.status === 'ADMIN_REVIEW'));
        }
      }

      if (slotRes) {
        const slots = Array.isArray(slotRes) ? slotRes : (slotRes.slotRequests || slotRes.requests || slotRes.data || []);
        setSlotRequests(slots);
      }

      if (userRes) {
        const users = Array.isArray(userRes) ? userRes : (userRes.users || userRes.data || []);
        setUsersList(users);
      }

      if (deptsList) {
        const depts = Array.isArray(deptsList) ? deptsList : (deptsList.departments || deptsList.data || []);
        setDepartments(depts);
      }

      if (auditRes) {
        const logs = Array.isArray(auditRes) ? auditRes : (auditRes.logs || auditRes.auditLogs || auditRes.data || []);
        setAuditLogs(logs);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const openDecisionModal = (act, type) => {
    setSelectedActivity(act);
    setDecisionModal(type);
    setDecisionNotes('');
  };

  const handleExecuteDecision = async () => {
    if (!selectedActivity || !decisionModal) return;

    if (decisionModal === 'REJECT' && !decisionNotes.trim()) {
      showToast('A mandatory rejection reason is required', 'warning');
      return;
    }
    if (decisionModal === 'REQUEST_CHANGES' && !decisionNotes.trim()) {
      showToast('Mandatory correction feedback notes are required', 'warning');
      return;
    }

    try {
      setDecisionLoading(true);
      let res;
      if (decisionModal === 'APPROVE') {
        res = await api.patch(`/activities/${selectedActivity._id}/admin-approve`, {
          notes: decisionNotes.trim()
        });
      } else if (decisionModal === 'REJECT') {
        res = await api.patch(`/activities/${selectedActivity._id}/admin-reject`, {
          reason: decisionNotes.trim()
        });
      } else if (decisionModal === 'REQUEST_CHANGES') {
        res = await api.patch(`/activities/${selectedActivity._id}/admin-request-changes`, {
          notes: decisionNotes.trim()
        });
      }

      if (res && res.success) {
        showToast(res.message || 'Decision recorded successfully', 'success');
        setDecisionModal(null);
        setSelectedActivity(null);
        setDecisionNotes('');
        fetchAdminData();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Operation failed';
      showToast(errMsg, 'error');
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleReviewSlot = async (slotId, action, selectedAlternativeIndex = null, adminNotes = '') => {
    try {
      const res = await api.put(`/slots/requests/${slotId}/review`, {
        action,
        selectedAlternativeIndex,
        adminNotes
      });
      if (res.success) {
        showToast(res.message, 'success');
        fetchAdminData();
      }
    } catch (err) {
      showToast(err.message || 'Slot review failed', 'error');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users/admin-create', userForm);
      if (res.success) {
        showToast(res.message, 'success');
        setShowUserModal(false);
        fetchAdminData();
      }
    } catch (err) {
      showToast(err.message || 'User creation failed', 'error');
    }
  };

  const handleToggleUserStatus = async (userId) => {
    try {
      const res = await api.put(`/users/${userId}/toggle-status`);
      if (res.success) {
        showToast(res.message, 'success');
        fetchAdminData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to change status', 'error');
    }
  };

  // Filtered Activities for Approval Center
  const filteredApprovalActivities = allApprovalsHistory.filter(act => {
    if (approvalStatusFilter !== 'ALL' && act.status !== approvalStatusFilter) {
      return false;
    }
    if (approvalDeptFilter) {
      const dId = act.departmentId?._id || act.departmentId;
      if (dId !== approvalDeptFilter) return false;
    }
    if (approvalCategoryFilter && act.category !== approvalCategoryFilter) {
      return false;
    }
    if (approvalSearch.trim()) {
      const q = approvalSearch.toLowerCase();
      const matchTitle = act.title?.toLowerCase().includes(q);
      const matchCoord = act.coordinatorId?.name?.toLowerCase().includes(q);
      if (!matchTitle && !matchCoord) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-rcpit-950 to-slate-900 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 bg-rose-950/80 px-3 py-1 rounded-full border border-rose-800">
            System & Operational Administrator Workspace
          </span>
          <h1 className="text-2xl font-extrabold mt-2">
            Central Administrative Operations Panel
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Institutional Final Approval Authority • Venue FCFS Scheduler • User Directory
          </p>
        </div>

        <div className="flex gap-2 self-start md:self-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" /> Propose Activity Request
          </button>
          <button
            onClick={() => setShowUserModal(true)}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all border border-slate-700"
          >
            <Plus className="w-4 h-4" /> Create User Account
          </button>
        </div>
      </div>

      <ActionCenter />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'approvals'
              ? 'bg-rcpit-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Activity Approval Center
          {pendingApprovals.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('slots')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'slots'
              ? 'bg-rcpit-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Slot & Venue Requests ({slotRequests.filter(s => s.status === 'PENDING' || s.status === 'CONFLICT_DETECTED').length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'users'
              ? 'bg-rcpit-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> Users ({usersList.length})
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'departments'
              ? 'bg-rcpit-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building className="w-4 h-4" /> Departments ({departments.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-rcpit-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-emerald-400" /> System Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* TAB 0: Activity Approval Center (New Workflow: Admin Final Approval) */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-rcpit-600" /> Institutional Activity Approval Center
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Review and grant final institutional approval or rejection for activity proposals forwarded by Department HODs
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-xs font-bold">
                <button
                  onClick={() => setApprovalStatusFilter('ADMIN_REVIEW')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    approvalStatusFilter === 'ADMIN_REVIEW'
                      ? 'bg-rcpit-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Pending Admin ({pendingApprovals.length})
                </button>
                <button
                  onClick={() => setApprovalStatusFilter('ADMIN_APPROVED')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    approvalStatusFilter === 'ADMIN_APPROVED'
                      ? 'bg-rcpit-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Approved ({allApprovalsHistory.filter(a => a.status === 'ADMIN_APPROVED').length})
                </button>
                <button
                  onClick={() => setApprovalStatusFilter('REJECTED')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    approvalStatusFilter === 'REJECTED'
                      ? 'bg-rcpit-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Rejected ({allApprovalsHistory.filter(a => a.status === 'REJECTED').length})
                </button>
                <button
                  onClick={() => setApprovalStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    approvalStatusFilter === 'ALL'
                      ? 'bg-rcpit-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All History
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={approvalSearch}
                  onChange={(e) => setApprovalSearch(e.target.value)}
                  placeholder="Search by activity title or faculty..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <select
                  value={approvalDeptFilter}
                  onChange={(e) => setApprovalDeptFilter(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-medium"
                >
                  <option value="">All Academic Departments</option>
                  {departments.map(d => (
                    <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={approvalCategoryFilter}
                  onChange={(e) => setApprovalCategoryFilter(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-medium"
                >
                  <option value="">All Activity Categories</option>
                  {['Workshop', 'Seminar', 'FDP', 'Guest Lecture', 'Hackathon', 'Competition', 'Industrial Visit', 'Training', 'Placement Drive', 'Conference'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Activities List */}
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading activity approval records...</div>
            ) : filteredApprovalActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                No activity proposals matching the current filters.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredApprovalActivities.map((act) => (
                  <div
                    key={act._id}
                    className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4 transition-all hover:border-rcpit-300 dark:hover:border-slate-600"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rcpit-600 dark:text-rcpit-400">
                            {act.category}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                            {act.departmentId?.name || 'Department'} ({act.departmentId?.code || ''})
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                          <Link
                            to={`/activities/${act._id}`}
                            className="hover:text-rcpit-600 dark:hover:text-rcpit-400 hover:underline transition-colors cursor-pointer"
                            title={act.title}
                          >
                            {act.title}
                          </Link>
                        </h4>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                          <span>
                            Coordinator: <strong className="text-slate-800 dark:text-slate-200">{act.coordinatorId?.name}</strong> ({act.coordinatorId?.designation} • {act.coordinatorId?.email})
                          </span>
                          {act.hodForwardedBy && (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              ✓ Reviewed & Endorsed by HOD: {act.hodForwardedBy?.name || 'Department HOD'}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={act.status} />
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 leading-relaxed">
                      {act.description}
                    </p>

                    {/* HOD Review Notes Callout */}
                    {act.hodReviewNotes && (
                      <div className="p-3 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-xs text-cyan-900 dark:text-cyan-200 flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-[11px] font-black uppercase text-cyan-800 dark:text-cyan-300">
                            HOD Endorsement & Review Notes:
                          </strong>
                          <span>{act.hodReviewNotes}</span>
                        </div>
                      </div>
                    )}

                    {/* Metadata Badges */}
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
                        <span>{act.expectedParticipants} Expected Attendees</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <DollarSign className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Budget: ₹{act.estimatedBudget?.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Decision Details if already decided */}
                    {act.adminReviewNotes && act.status !== 'ADMIN_REVIEW' && (
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                        <span className="font-bold uppercase text-[10px] text-slate-500 block">Admin Decision Record:</span>
                        <p>{act.adminReviewNotes}</p>
                        {act.adminDecisionAt && (
                          <span className="text-[10px] text-slate-400 block">
                            Decision Date: {new Date(act.adminDecisionAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <Link
                        to={`/activities/${act._id}`}
                        className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-rcpit-600 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Activity Full Page
                      </Link>

                      {act.status === 'ADMIN_REVIEW' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDecisionModal(act, 'REJECT')}
                            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-colors"
                          >
                            Reject Proposal
                          </button>
                          <button
                            onClick={() => openDecisionModal(act, 'REQUEST_CHANGES')}
                            className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-200 dark:border-amber-800 transition-colors"
                          >
                            Return for Changes
                          </button>
                          <button
                            onClick={() => openDecisionModal(act, 'APPROVE')}
                            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve Activity
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: Slot Requests & Conflict Resolution Engine */}
      {activeTab === 'slots' && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-rcpit-600" /> Central Slot Verification & Conflict Engine
          </h3>

          {slotRequests.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No slot requests submitted.</div>
          ) : (
            <div className="space-y-4">
              {slotRequests.map((req) => (
                <div
                  key={req._id}
                  className={`p-5 rounded-2xl border space-y-3 transition-all ${
                    req.status === 'CONFLICT_DETECTED'
                      ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-rcpit-600 dark:text-rcpit-400">
                          {req.venueId?.name || 'Requested Venue'}
                        </span>
                        {req.status === 'CONFLICT_DETECTED' && (
                          <span className="px-2 py-0.5 bg-rose-600 text-white font-extrabold text-[10px] rounded-full flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> VENUE COLLISION DETECTED
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {req.activityId?._id ? (
                          <Link
                            to={`/activities/${req.activityId._id}`}
                            className="hover:text-rcpit-600 dark:hover:text-rcpit-400 hover:underline transition-colors cursor-pointer"
                            title={req.activityId?.title}
                          >
                            {req.activityId?.title || 'Activity Title'}
                          </Link>
                        ) : (
                          req.activityId?.title || 'Activity Title'
                        )}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Requested Date: {new Date(req.requestedDate).toLocaleDateString()} ({req.startTime} - {req.endTime})
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  {req.conflictDetails?.hasConflict && (
                    <div className="p-3 bg-rose-100 dark:bg-rose-900/60 rounded-xl border border-rose-300 dark:border-rose-700 text-xs text-rose-900 dark:text-rose-200 font-semibold space-y-2">
                      <p>⚠️ {req.conflictDetails.conflictMessage}</p>
                      {req.suggestedAlternatives?.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <p className="font-extrabold uppercase text-[10px] text-rose-700 dark:text-rose-300">
                            Available Alternative Time Slots:
                          </p>
                          {req.suggestedAlternatives.map((alt, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg text-[11px]">
                              <span>{alt.label}</span>
                              <button
                                onClick={() => handleReviewSlot(req._id, 'APPLY_ALTERNATIVE', idx, `Assigned alternative ${alt.label}`)}
                                className="px-3 py-1 bg-rcpit-600 text-white font-extrabold text-[10px] rounded-lg shadow-sm"
                              >
                                Allocate Alternative
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">
                      Coordinator: {req.requestedBy?.name || 'Faculty Member'} ({req.requestedBy?.email || 'N/A'})
                    </span>

                    {req.status === 'PENDING' && (
                      <div className="space-x-2">
                        <button
                          onClick={() => handleReviewSlot(req._id, 'REJECT')}
                          className="px-3 py-1.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold rounded-xl"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleReviewSlot(req._id, 'APPROVE')}
                          className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-xl shadow-sm"
                        >
                          Approve Slot
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Users */}
      {activeTab === 'users' && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-rcpit-600" /> Institutional User Management
            </h3>
            <button
              onClick={() => setShowUserModal(true)}
              className="px-4 py-2 bg-rcpit-600 text-white font-bold text-xs rounded-xl"
            >
              + Create User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usersList.map((u) => (
                  <tr key={u._id}>
                    <td className="p-3 font-mono font-bold">{u.facultyEmployeeId || u.employeeId || '—'}</td>
                    <td className="p-3 font-bold">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3 font-semibold">{u.role}</td>
                    <td className="p-3">{u.departmentId?.name || 'All'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'ACTIVE' || u.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggleUserStatus(u._id)}
                        className="text-xs text-rcpit-600 dark:text-rcpit-400 font-bold hover:underline"
                      >
                        {u.status === 'ACTIVE' || u.status === 'APPROVED' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Departments */}
      {activeTab === 'departments' && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-rcpit-600" /> Academic & Administrative Departments
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((d) => (
              <div key={d._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[10px] font-bold text-rcpit-600">{d.code}</span>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{d.name}</h4>
                <p className="text-xs text-slate-500">
                  Head of Department: <strong className="text-slate-700 dark:text-slate-300">{d.hodId?.name || 'Unassigned'}</strong>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-500" /> Centralized System Audit Trail
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.slice(0, 50).map((log) => (
                  <tr key={log._id}>
                    <td className="p-3 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-bold">{log.userName} ({log.userRole})</td>
                    <td className="p-3 font-mono font-bold text-rcpit-600">{log.action}</td>
                    <td className="p-3">{log.entity}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Decision Modal: Approve, Request Changes, Reject */}
      {decisionModal && selectedActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                {decisionModal === 'APPROVE' && <><CheckCircle className="w-4 h-4 text-emerald-600" /> Grant Final Institutional Approval</>}
                {decisionModal === 'REQUEST_CHANGES' && <><RotateCcw className="w-4 h-4 text-amber-600" /> Request Corrections from Coordinator</>}
                {decisionModal === 'REJECT' && <><XCircle className="w-4 h-4 text-rose-600" /> Reject Activity Proposal</>}
              </h3>
              <button
                onClick={() => setDecisionModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                Activity: <span className="text-rcpit-600">{selectedActivity.title}</span>
              </p>
              <p className="text-slate-500">
                Department: {selectedActivity.departmentId?.name || 'Department'}
              </p>
              <p className="text-slate-500">
                Coordinator: {selectedActivity.coordinatorId?.name} ({selectedActivity.coordinatorId?.email})
              </p>
              {selectedActivity.hodReviewNotes && (
                <p className="text-cyan-700 dark:text-cyan-400 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700">
                  HOD Endorsement: "{selectedActivity.hodReviewNotes}"
                </p>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                {decisionModal === 'APPROVE'
                  ? 'Official Approval Comments (Optional):'
                  : decisionModal === 'REQUEST_CHANGES'
                  ? 'Mandatory Correction Instructions *:'
                  : 'Mandatory Institutional Rejection Reason *:'}
              </label>
              <textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={
                  decisionModal === 'APPROVE'
                    ? 'e.g. Approved by System Administrator. Proceed to venue and execution scheduling.'
                    : decisionModal === 'REQUEST_CHANGES'
                    ? 'e.g. Please revise the proposed time slot or expand the target audience details.'
                    : 'e.g. Does not meet institutional criteria or conflicts with schedule.'
                }
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-rcpit-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDecisionModal(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDecision}
                disabled={decisionLoading}
                className={`px-5 py-2 font-extrabold text-xs text-white rounded-xl shadow-md disabled:opacity-50 transition-all ${
                  decisionModal === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : decisionModal === 'REQUEST_CHANGES'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {decisionLoading ? 'Processing...' : decisionModal === 'APPROVE' ? 'Confirm Approval' : decisionModal === 'REQUEST_CHANGES' ? 'Send Correction Notes' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Creation Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Provision Institutional Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text" required value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="e.g. Dr. A. B. Patil"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Official Email</label>
                <input
                  type="email" required value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="e.g. user@rcpit.ac.in"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Employee ID</label>
                <input
                  type="text" required value={userForm.employeeId}
                  onChange={(e) => setUserForm({ ...userForm, employeeId: e.target.value })}
                  placeholder="e.g. RCPIT-FAC-045"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Password <span className="text-slate-400 font-normal text-[10px]">(Required initial password)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Enter password for account ID"
                    className="w-full p-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="HOD">HOD</option>
                  <option value="FACULTY">FACULTY</option>
                  <option value="TP">T&P CELL</option>
                  <option value="DIRECTOR">DIRECTOR</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <select
                  value={userForm.departmentId}
                  onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">None / Administration</option>
                  {departments.map(d => (
                    <option key={d._id || d.code} value={d._id || d.code} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button" onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rcpit-600 text-white font-bold text-xs rounded-xl"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Creation Modal */}
      <CreateActivityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchAdminData}
      />

    </div>
  );
};

export default AdminDashboard;
