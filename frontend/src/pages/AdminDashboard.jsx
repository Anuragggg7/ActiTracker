import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import ActionCenter from '../components/ActionCenter';
import StatusBadge from '../components/StatusBadge';
import { useNotifications } from '../context/NotificationContext';
import { fetchDepartmentsWithFallback } from '../utils/departments';
import CreateActivityModal from '../components/CreateActivityModal';
import {
  Users, Building, Clock, ShieldAlert, Plus, AlertTriangle, CheckCircle, XCircle, Search, RefreshCw, Eye, EyeOff
} from 'lucide-react';

export const AdminDashboard = () => {
  const { showToast } = useNotifications();
  const [activeTab, setActiveTab] = useState('slots'); // 'slots', 'users', 'departments', 'audit'

  const [slotRequests, setSlotRequests] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // User Creation Form Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '', email: '', password: '', role: 'HOD', departmentId: '', employeeId: '', designation: ''
  });

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [slotRes, userRes, deptsList, auditRes] = await Promise.all([
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
            Single Admin System Controller • User & Slot Scheduling Engine
          </p>
        </div>

        <div className="flex gap-2 self-start md:self-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Activity (Photos/Videos)
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
          onClick={() => setActiveTab('slots')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'slots' ? 'bg-rcpit-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Slot & Venue Requests ({slotRequests.filter(s => s.status === 'PENDING' || s.status === 'CONFLICT_DETECTED').length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'users' ? 'bg-rcpit-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> Users ({usersList.length})
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'departments' ? 'bg-rcpit-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building className="w-4 h-4" /> Departments ({departments.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'audit' ? 'bg-rcpit-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-emerald-400" /> System Audit Trail ({auditLogs.length})
        </button>
      </div>

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
                        {req.activityId?.title || 'Activity Title'}
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
                                className="px-2.5 py-1 bg-rcpit-600 text-white font-bold rounded-lg text-[10px]"
                              >
                                Apply Alternative
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {req.status === 'PENDING' && (
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleReviewSlot(req._id, 'REJECT')}
                        className="px-3 py-1.5 bg-rose-100 text-rose-700 font-bold text-xs rounded-xl"
                      >
                        Reject Slot
                      </button>
                      <button
                        onClick={() => handleReviewSlot(req._id, 'APPROVE')}
                        className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm"
                      >
                        Approve & Confirm Venue Slot
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Users Management */}
      {activeTab === 'users' && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-rcpit-600" /> User Accounts Directory
            </h3>
            <button
              onClick={() => setShowUserModal(true)}
              className="px-3.5 py-1.5 bg-rcpit-600 text-white font-bold text-xs rounded-xl shadow-sm"
            >
              + Create User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="pb-3 px-2">Name & ID</th>
                  <th className="pb-3 px-2">Role</th>
                  <th className="pb-3 px-2">Department</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usersList.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-2">
                      <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                      <p className="text-[10px] text-slate-400">{u.email} • {u.employeeId}</p>
                    </td>
                    <td className="py-3 px-2">
                      <span className="font-bold text-rcpit-600 uppercase text-[10px]">{u.role}</span>
                    </td>
                    <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                      {u.departmentId?.name || 'N/A'}
                    </td>
                    <td className="py-3 px-2">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-3 px-2 text-right">
                      {u.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleToggleUserStatus(u._id)}
                          className={`px-3 py-1 text-[11px] font-bold rounded-lg ${
                            u.status === 'SUSPENDED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {u.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Departments Master Directory */}
      {activeTab === 'departments' && (
        <div className="glass-card p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-rcpit-600" /> Academic Departments Directory ({departments.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of all institutional academic departments, appointed HODs, and faculty counts
              </p>
            </div>
            <Link
              to="/admin/departments"
              className="px-3.5 py-2 bg-rcpit-600 hover:bg-rcpit-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Building className="w-4 h-4" /> Manage Departments & HODs
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {departments.map((dept) => (
              <div
                key={dept._id || dept.code}
                className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3 hover:border-rcpit-500 transition-all shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-rcpit-50 text-rcpit-600 dark:bg-slate-900 dark:text-rcpit-400 uppercase tracking-wider">
                      {dept.code}
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-2 leading-tight">
                      {dept.name}
                    </h4>
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border border-emerald-200 dark:border-emerald-800">
                    {dept.performanceScore ?? 0}% Score
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 space-y-0.5 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                    Head of Department (HOD)
                  </span>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200">
                    {dept.hodId?.name || 'No HOD Assigned'}
                  </p>
                  {dept.hodId?.email && (
                    <p className="text-[11px] text-slate-500 truncate">{dept.hodId.email}</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Faculty: <strong className="text-slate-800 dark:text-slate-200">{dept.facultyCount ?? 0}</strong></span>
                  <span className="font-bold text-emerald-600 text-[11px]">Active Unit</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: System Audit Trail */}
      {activeTab === 'audit' && (
        <div className="glass-card p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-500" /> Immutable System Audit Trail ({auditLogs.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time security audit log of user authentications, status changes, and governance events
              </p>
            </div>
            <Link
              to="/audit-logs"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all border border-slate-700"
            >
              <Clock className="w-4 h-4" /> Full Audit Portal
            </Link>
          </div>

          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No audit log records available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="pb-3 px-2">Timestamp</th>
                    <th className="pb-3 px-2">User / Role</th>
                    <th className="pb-3 px-2">Action Event</th>
                    <th className="pb-3 px-2">Target Entity</th>
                    <th className="pb-3 px-2">Event Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.slice(0, 30).map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-2 text-slate-500 font-medium whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">
                        <div>{log.userName || 'System'}</div>
                        <div className="text-[10px] text-rcpit-600 uppercase font-extrabold">{log.userRole}</div>
                      </td>
                      <td className="py-3 px-2 font-bold text-slate-800 dark:text-slate-200">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                        {log.entity}
                      </td>
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {log.details || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* User Creation Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Create Official Account
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text" required value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Dr. Full Name"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Official Email</label>
                <input
                  type="email" required value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="user@rcpit.ac.in"
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

      {/* Universal Photo & Video Activity Creation Modal */}
      <CreateActivityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchAdminData}
      />

    </div>
  );
};

export default AdminDashboard;
