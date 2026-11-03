import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/client';
import ActionCenter from '../components/ActionCenter';
import StatusBadge from '../components/StatusBadge';
import { useNotifications } from '../context/NotificationContext';
import { fetchDepartmentsWithFallback } from '../utils/departments';
import CreateActivityModal from '../components/CreateActivityModal';
import AnnualReportManager from '../components/AnnualReportManager';
import {
  Users, Building, Clock, ShieldAlert, Plus, AlertTriangle, CheckCircle, XCircle,
  Search, RefreshCw, Eye, EyeOff, CheckSquare, Send, RotateCcw, Calendar, MapPin,
  DollarSign, MessageSquare, Filter, ShieldCheck, X, Flame, Zap, Award, CheckCircle2,
  FileText
} from 'lucide-react';

export const AdminDashboard = () => {
  const { showToast } = useNotifications();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals', 'reallocation', 'slots', 'users', 'departments', 'audit', 'annual-reports'

  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [allApprovalsHistory, setAllApprovalsHistory] = useState([]);
  const [slotRequests, setSlotRequests] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [waitingQueueEntries, setWaitingQueueEntries] = useState([]);
  const [slotOffersList, setSlotOffersList] = useState([]);
  const [cancellationRecords, setCancellationRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Approval Center Filters & Search
  const [approvalSearch, setApprovalSearch] = useState('');
  const [approvalDeptFilter, setApprovalDeptFilter] = useState('');
  const [approvalCategoryFilter, setApprovalCategoryFilter] = useState('');
  const [approvalPriorityFilter, setApprovalPriorityFilter] = useState('ALL'); // 'ALL', 'HIGH', 'MEDIUM', 'NORMAL'
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
      const [
        pendingActRes,
        allActRes,
        slotRes,
        userRes,
        deptsList,
        auditRes,
        queueRes,
        offersRes,
        cancelsRes
      ] = await Promise.all([
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
        }),
        api.get('/slots/waiting-queue').catch(() => ({ success: false })),
        api.get('/slots/offers').catch(() => ({ success: false })),
        api.get('/slots/cancellations').catch(() => ({ success: false }))
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

      if (queueRes && queueRes.success) {
        setWaitingQueueEntries(queueRes.waitingQueue || []);
      }

      if (offersRes && offersRes.success) {
        setSlotOffersList(offersRes.offers || []);
      }

      if (cancelsRes && cancelsRes.success) {
        setCancellationRecords(cancelsRes.history || []);
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

  // Smooth scroll to target activity if opened with hash (e.g., from Action Center)
  useEffect(() => {
    if (loading) return;
    const hash = location.hash || window.location.hash;
    if (!hash) return;
    const targetId = hash.replace(/^#/, '');
    const cleanId = targetId.replace(/^activity-/, '');

    const tryScroll = () => {
      const el =
        document.getElementById(targetId) ||
        document.getElementById(`activity-${cleanId}`) ||
        document.getElementById(cleanId) ||
        document.querySelector(`[data-activity-id="${cleanId}"]`);

      if (el) {
        const headerOffset = 100;
        const elPos = el.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top: Math.max(0, elPos), behavior: 'smooth' });
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (err) {
          // ignore
        }
        el.classList.add('ring-4', 'ring-amber-500', 'ring-offset-4', 'bg-amber-500/10', 'transition-all', 'duration-500');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-amber-500', 'ring-offset-4', 'bg-amber-500/10');
        }, 3500);
        return true;
      }
      return false;
    };

    if (!tryScroll()) {
      const t1 = setTimeout(tryScroll, 150);
      const t2 = setTimeout(tryScroll, 400);
      const t3 = setTimeout(tryScroll, 800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [loading, location.hash, location.key, pendingApprovals]);

  const openDecisionModal = (act, type) => {
    setSelectedActivity(act);
    setDecisionModal(type);
    setDecisionNotes('');
  };

  const handleExecuteDecision = async () => {
    if (!selectedActivity || !decisionModal) return;

    if (decisionModal === 'REJECT' && !decisionNotes.trim()) {
      showToast('A mandatory rejection reason is strictly required to reject an activity', 'warning');
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

  // Filtered Activities for Approval Center (Enhancement E: Priority filter support)
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
    if (approvalPriorityFilter !== 'ALL' && (act.hodPriority || 'NORMAL') !== approvalPriorityFilter) {
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

  const renderPriorityBadge = (p) => {
    if (p === 'HIGH') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-extrabold text-[10px] inline-flex items-center gap-1 border border-rose-300 dark:border-rose-800">
          <Flame className="w-3 h-3 text-rose-600" /> HIGH PRIORITY
        </span>
      );
    }
    if (p === 'MEDIUM') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-[10px] inline-flex items-center gap-1 border border-amber-300 dark:border-amber-800">
          <Zap className="w-3 h-3 text-amber-600" /> MEDIUM PRIORITY
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[10px] inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700">
        NORMAL PRIORITY
      </span>
    );
  };

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
            Institutional Final Approval Authority • Smart Slot Reallocation • User Directory
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
          onClick={() => setActiveTab('reallocation')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'reallocation'
              ? 'bg-rcpit-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <RefreshCw className="w-4 h-4 text-emerald-400" /> Smart Slot Reallocation & Waiting Queue ({waitingQueueEntries.filter(w => w.status === 'WAITING').length})
        </button>

        <button
          onClick={() => setActiveTab('slots')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'slots'
              ? 'bg-rcpit-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Slot Requests ({slotRequests.filter(s => s.status === 'PENDING' || s.status === 'CONFLICT_DETECTED').length})
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

        <button
          onClick={() => setActiveTab('annual-reports')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'annual-reports'
              ? 'bg-rcpit-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-cyan-400" /> Annual Reports
        </button>
      </div>

      {/* TAB 0: Activity Approval Center (Enhancements E & F) */}
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

            {/* Filter & Search Bar with Priority Filter (Enhancement E) */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={approvalSearch}
                  onChange={(e) => setApprovalSearch(e.target.value)}
                  placeholder="Search by title or coordinator..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <select
                  value={approvalPriorityFilter}
                  onChange={(e) => setApprovalPriorityFilter(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-bold"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="HIGH">🔥 High Priority Only</option>
                  <option value="MEDIUM">⚡ Medium Priority Only</option>
                  <option value="NORMAL">Normal Priority Only</option>
                </select>
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
                    id={`activity-${act._id}`}
                    data-activity-id={act._id}
                    className="scroll-mt-24 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4 transition-all hover:border-rcpit-300 dark:hover:border-slate-600"
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
                          {renderPriorityBadge(act.hodPriority)}
                          {act.isAllDay && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black uppercase">
                              All-Day Event
                            </span>
                          )}
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

                    {/* HOD Review Notes & Priority Reason Callout */}
                    {(act.hodPriorityReason || act.hodReviewNotes) && (
                      <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-xs text-cyan-900 dark:text-cyan-200 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-cyan-800 dark:text-cyan-300 uppercase text-[10px]">
                          <MessageSquare className="w-3.5 h-3.5 text-cyan-600" />
                          HOD Recommendation Details:
                        </div>
                        {act.hodPriorityReason && (
                          <p><strong>Priority Reason ({act.hodPriority || 'NORMAL'}):</strong> {act.hodPriorityReason}</p>
                        )}
                        {act.hodReviewNotes && act.hodReviewNotes !== act.hodPriorityReason && (
                          <p><strong>Review Notes:</strong> {act.hodReviewNotes}</p>
                        )}
                      </div>
                    )}

                    {/* Multi-Session Breakdown if applicable */}
                    {Array.isArray(act.sessions) && act.sessions.length > 1 && (
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                        <span className="font-extrabold text-rcpit-600 dark:text-rcpit-400 text-[11px] flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" /> Multiple Scheduled Sessions ({act.sessions.length} Occurrences):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {act.sessions.map((s, idx) => (
                            <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]">
                              <span className="font-bold">{s.sessionTitle || `Session ${idx + 1}`}: </span>
                              <span>{new Date(s.date).toLocaleDateString()} ({s.isAllDay ? 'All-Day' : `${s.startTime}-${s.endTime}`})</span>
                              <div className="text-slate-500 mt-0.5">
                                Venue: {s.venueName || 'TBD'} • Exp: {s.expectedParticipants}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata Badges with Venue Capacity */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-rcpit-600 shrink-0" />
                        <span>{new Date(act.date).toLocaleDateString()} ({act.isAllDay ? 'All-Day' : `${act.startTime} - ${act.endTime}`})</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>Venue: {act.venueName || act.venueId?.name || 'TBD'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          Expected: {act.expectedParticipants} Attendees
                          {act.venueId?.capacity ? ` (Cap: ${act.venueId.capacity})` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <DollarSign className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Budget: ₹{act.estimatedBudget?.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Rejection reason display if rejected */}
                    {act.rejectionReason && act.status === 'REJECTED' && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
                        <strong className="block text-[11px] font-black uppercase text-rose-700 dark:text-rose-300">
                          Official Institutional Rejection Reason:
                        </strong>
                        <span>{act.rejectionReason}</span>
                      </div>
                    )}

                    {/* Decision Details if already decided */}
                    {act.adminReviewNotes && act.status !== 'ADMIN_REVIEW' && act.status !== 'REJECTED' && (
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

      {/* TAB 1: Smart Slot Reallocation & Waiting Queue (Enhancement C) */}
      {activeTab === 'reallocation' && (
        <div className="space-y-6">
          {/* Active FCFS Waiting Queue */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-rcpit-600" /> FCFS Waiting Queue Allocation Engine
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ordered strictly by original server-generated request timestamp. Reallocates automatically when a confirmed booking is cancelled.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full">
                {waitingQueueEntries.filter(w => w.status === 'WAITING').length} Active In Queue
              </span>
            </div>

            {waitingQueueEntries.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No active waiting queue entries currently registered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 text-[10px] uppercase border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">FCFS Order</th>
                      <th className="p-3">Activity</th>
                      <th className="p-3">Requested Venue</th>
                      <th className="p-3">Target Date & Time</th>
                      <th className="p-3">Requester</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Queue Status</th>
                      <th className="p-3">Queue Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {waitingQueueEntries.map((entry, idx) => (
                      <tr key={entry._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-black text-rcpit-600">
                          #{idx + 1}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                          {entry.activityId?.title || 'Activity'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {entry.venueId?.name || 'Venue'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString()} ({entry.isAllDay ? 'All-Day' : `${entry.startTime} - ${entry.endTime}`})
                        </td>
                        <td className="p-3 text-slate-500">
                          {entry.requestedBy?.name || 'Faculty'}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {renderPriorityBadge(entry.priority)}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            entry.status === 'WAITING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                            entry.status === 'OFFERED' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 animate-pulse' :
                            entry.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(entry.queueTimestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cancellation & Reallocation Audit History */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-rose-600" /> Booking Cancellation & Slot Reallocation History
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Immutable institutional audit log of cancelled bookings, released venue slots, and smart reallocation outcomes
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                {cancellationRecords.length} Cancellations Logged
              </span>
            </div>

            {cancellationRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No cancellations recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 text-[10px] uppercase border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Cancelled Activity</th>
                      <th className="p-3">Released Venue & Slot</th>
                      <th className="p-3">Cancelled By</th>
                      <th className="p-3">Cancellation Reason</th>
                      <th className="p-3">Reallocation Outcome</th>
                      <th className="p-3">Cancellation Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cancellationRecords.map((c) => (
                      <tr key={c._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                          {c.activityTitle || c.activityId?.title || 'Activity'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <div>{c.venueName || c.venueId?.name || 'Venue'}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(c.date).toLocaleDateString()} ({c.startTime} - {c.endTime})
                          </div>
                        </td>
                        <td className="p-3 text-slate-500">
                          {c.cancellerName || c.cancelledBy?.name || 'User'} ({c.cancellerRole || c.cancelledBy?.role})
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={c.cancellationReason}>
                          {c.cancellationReason}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            c.reallocationStatus === 'REALLOCATED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                            c.reallocationStatus === 'OFFERED' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {c.reallocationStatus}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(c.cancelledAt || c.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Slot Requests & Conflict Resolution Engine */}
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
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-md"
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

      {/* TAB 3: Users */}
      {activeTab === 'users' && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-rcpit-600" /> Authorized Institutional Accounts ({usersList.length})
            </h3>
            <button
              onClick={() => setShowUserModal(true)}
              className="px-4 py-2 bg-rcpit-600 hover:bg-rcpit-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 text-[10px] uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">User Name</th>
                  <th className="p-3">Official Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usersList.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{u.name}</td>
                    <td className="p-3 text-slate-500">{u.email}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{u.departmentId?.name || u.department?.name || 'Administration'}</td>
                    <td className="p-3 font-mono text-slate-500">{u.facultyEmployeeId || u.employeeId || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'APPROVED' || u.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {u.status || 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Departments */}
      {activeTab === 'departments' && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-rcpit-600" /> Academic Departments & Units ({departments.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((d) => (
              <div key={d._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="px-2 py-0.5 rounded bg-rcpit-50 dark:bg-rcpit-950 text-rcpit-600 dark:text-rcpit-400 font-mono font-black text-xs">
                  {d.code}
                </span>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{d.name}</h4>
                <p className="text-xs text-slate-500">HOD: {d.hodId?.name || 'Assigned HOD'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Audit Log */}
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

      {/* TAB 6: Annual Report Generator */}
      {activeTab === 'annual-reports' && (
        <AnnualReportManager />
      )}

      {/* Admin Decision Modal: Approve, Request Changes, Reject (Enhancement F) */}
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
              <div className="flex items-center gap-2">
                <span className="text-slate-500">HOD Recommended Priority:</span>
                {renderPriorityBadge(selectedActivity.hodPriority)}
              </div>
              {selectedActivity.hodPriorityReason && (
                <p className="text-amber-800 dark:text-amber-300 text-[11px]">
                  <strong>HOD Reason:</strong> "{selectedActivity.hodPriorityReason}"
                </p>
              )}
              <p className="text-slate-500">
                Department: {selectedActivity.departmentId?.name || 'Department'}
              </p>
              <p className="text-slate-500">
                Coordinator: {selectedActivity.coordinatorId?.name} ({selectedActivity.coordinatorId?.email})
              </p>
              {selectedActivity.hodReviewNotes && (
                <p className="text-cyan-700 dark:text-cyan-400 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700">
                  HOD Review Notes: "{selectedActivity.hodReviewNotes}"
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
                required={decisionModal === 'REJECT' || decisionModal === 'REQUEST_CHANGES'}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={
                  decisionModal === 'APPROVE'
                    ? 'e.g. Approved by System Administrator. Proceed to venue and execution scheduling.'
                    : decisionModal === 'REQUEST_CHANGES'
                    ? 'e.g. Please revise the proposed time slot or expand the target audience details.'
                    : 'e.g. Proposal does not satisfy institutional syllabus criteria or budgetary limits.'
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
