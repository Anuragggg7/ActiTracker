import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
  Users, Search, UserPlus, Shield, Edit, KeyRound, CheckCircle,
  XCircle, Lock, Building, Filter, RefreshCw
} from 'lucide-react';

export const UserManagement = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetPassUser, setResetPassUser] = useState(null);

  // Form states
  const [addForm, setAddForm] = useState({
    employeeId: '',
    name: '',
    email: '',
    password: '',
    departmentId: '',
    role: 'FACULTY',
    designation: 'Assistant Professor',
    specialization: '',
    qualification: '',
    phone: '',
    status: 'ACTIVE'
  });

  const [editForm, setEditForm] = useState({
    employeeId: '',
    name: '',
    email: '',
    departmentId: '',
    designation: '',
    specialization: '',
    qualification: '',
    phone: '',
    status: 'ACTIVE'
  });

  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, deptsRes] = await Promise.all([
        api.get('/users').catch((err) => {
          console.warn('User fetch warning:', err.message);
          return { success: false };
        }),
        api.get('/departments').catch((err) => {
          console.warn('Departments fetch warning:', err.message);
          return { success: false };
        })
      ]);

      if (usersRes) {
        const uList = Array.isArray(usersRes) ? usersRes : (usersRes.users || usersRes.data || []);
        setUsers(uList);
      }

      if (deptsRes) {
        const dList = Array.isArray(deptsRes) ? deptsRes : (deptsRes.departments || deptsRes.data || []);
        setDepartments(dList);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch institutional user data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Add Faculty Submit
  const handleAddFacultySubmit = async (e) => {
    e.preventDefault();
    if (!addForm.employeeId.trim() || !addForm.name.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      showToast('Employee ID, Name, Email, and Initial Password are required.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/users/faculty', addForm);
      if (res.success) {
        showToast(`Faculty account provisioned for ${res.faculty?.name} (${res.faculty?.employeeId})`, 'success');
        setShowAddModal(false);
        setAddForm({
          employeeId: '',
          name: '',
          email: '',
          password: '',
          departmentId: '',
          role: 'FACULTY',
          designation: 'Assistant Professor',
          specialization: '',
          qualification: '',
          phone: '',
          status: 'ACTIVE'
        });
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to provision faculty account', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (u) => {
    setEditUser(u);
    setEditForm({
      employeeId: u.employeeId || '',
      name: u.name || '',
      email: u.email || '',
      departmentId: u.departmentId?._id || u.departmentId || '',
      designation: u.designation || 'Assistant Professor',
      specialization: u.specialization || '',
      qualification: u.qualification || '',
      phone: u.phone || '',
      status: u.status || 'ACTIVE'
    });
  };

  // Handle Edit Faculty Submit
  const handleEditFacultySubmit = async (e) => {
    e.preventDefault();
    if (!editUser) return;

    try {
      setSubmitting(true);
      const res = await api.put(`/users/faculty/${editUser._id}`, editForm);
      if (res.success) {
        showToast(`Profile details updated for ${res.faculty?.name}`, 'success');
        setEditUser(null);
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update user profile', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle Status
  const handleToggleStatus = async (targetUser) => {
    const isCurrentActive = targetUser.status === 'ACTIVE' || targetUser.status === 'APPROVED';
    const nextStatus = isCurrentActive ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.patch(`/users/faculty/${targetUser._id}/status`, { status: nextStatus });
      if (res.success) {
        showToast(`Account status for ${targetUser.name} changed to ${nextStatus}`, 'success');
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to toggle account status', 'error');
    }
  };

  // Handle Reset Password Submit
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetPassUser || !newPasswordInput.trim()) {
      showToast('Password cannot be empty.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.patch(`/users/faculty/${resetPassUser._id}/password`, { newPassword: newPasswordInput.trim() });
      if (res.success) {
        showToast(res.message || `Password reset for ${resetPassUser.name}`, 'success');
        setResetPassUser(null);
        setNewPasswordInput('');
      }
    } catch (err) {
      showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.employeeId?.toLowerCase().includes(search.toLowerCase());

    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesDept = !deptFilter || (u.departmentId?._id || u.departmentId) === deptFilter;

    return matchesSearch && matchesRole && matchesDept;
  });

  const isSystemAdminRole = user?.role === 'ADMIN';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-rcpit-900 via-rcpit-800 to-rcpit-950 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rcpit-400 bg-rcpit-950/80 px-3 py-1 rounded-full border border-rcpit-800">
            System Administration
          </span>
          <h1 className="text-2xl font-extrabold mt-2 flex items-center gap-2">
            <Users className="w-6 h-6 text-rcpit-400" /> Institutional User & Faculty Management
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Provision institutional Faculty IDs, manage credentials, profile updates & active account statuses
          </p>
        </div>

        {isSystemAdminRole && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-3 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all self-start md:self-auto"
          >
            <UserPlus className="w-4 h-4" /> Provision New Faculty Account
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Employee ID, Name, Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
          >
            <option value="">All Roles</option>
            <option value="FACULTY">Faculty Members</option>
            <option value="HOD">Head of Department (HOD)</option>
            <option value="TP">T&P Officer</option>
            <option value="DIRECTOR">Director</option>
            <option value="ADMIN">System Admin</option>
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          <span className="text-slate-400 font-extrabold whitespace-nowrap">
            Total Accounts: {filteredUsers.length}
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card p-6 space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading institutional accounts...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 font-bold">
            No faculty accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="pb-3 px-3">Official Employee ID</th>
                  <th className="pb-3 px-3">Faculty / User Details</th>
                  <th className="pb-3 px-3">Role</th>
                  <th className="pb-3 px-3">Department</th>
                  <th className="pb-3 px-3">Designation</th>
                  <th className="pb-3 px-3">Account Status</th>
                  {isSystemAdminRole && <th className="pb-3 px-3 text-right">Admin Controls</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const isActive = u.status === 'ACTIVE' || u.status === 'APPROVED';
                  return (
                    <tr key={u._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-extrabold text-rcpit-600 dark:text-rcpit-400">
                        {u.employeeId || 'N/A'}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                        <div>{u.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rcpit-50 text-rcpit-600 dark:bg-rcpit-950 dark:text-rcpit-400">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        {u.departmentId?.name || 'Central Institution'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400">
                        {u.designation || 'N/A'}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      {isSystemAdminRole && (
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(u)}
                              title="Edit Profile"
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-[11px] transition-colors flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>

                            <button
                              onClick={() => setResetPassUser(u)}
                              title="Reset Password"
                              className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 font-extrabold text-[11px] transition-colors flex items-center gap-1"
                            >
                              <KeyRound className="w-3.5 h-3.5" /> Password
                            </button>

                            {u.role !== 'ADMIN' && (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`px-2.5 py-1.5 rounded-xl font-extrabold text-[11px] transition-colors ${
                                  isActive
                                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}
                              >
                                {isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: PROVISION NEW FACULTY ACCOUNT */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rcpit-400" /> Provision New Faculty Account
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddFacultySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Official Employee / Faculty ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RCPIT-FAC-001"
                  value={addForm.employeeId}
                  onChange={(e) => setAddForm({ ...addForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 font-mono text-xs font-bold text-white focus:outline-none focus:border-rcpit-500"
                />
                <span className="text-[10px] text-slate-400">Assigned institutional identity (Unique & Immutable).</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Prof. Nilesh Patil"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Official Institutional Email <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="nilesh.patil@rcpit.ac.in"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Department <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={addForm.departmentId}
                    onChange={(e) => setAddForm({ ...addForm, departmentId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-bold"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Initial Password <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Initial password"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="Assistant Professor"
                    value={addForm.designation}
                    onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Account Status</label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-bold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold rounded-xl shadow-lg"
                >
                  {submitting ? 'Provisioning...' : 'Provision Faculty Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT FACULTY PROFILE */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-rcpit-400" /> Edit Faculty Profile
              </h3>
              <button
                onClick={() => setEditUser(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditFacultySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-2">
                  Official Employee ID
                  <span className="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded border border-slate-700 font-mono font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Official ID (Immutable)
                  </span>
                </label>
                <input
                  type="text"
                  disabled
                  value={editForm.employeeId}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs font-bold text-slate-400 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-500">
                  Institutional Employee ID cannot be modified through profile editing.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Official Email</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Department</label>
                  <select
                    value={editForm.departmentId}
                    onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-bold"
                  >
                    <option value="">Central Institution</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Designation</label>
                  <input
                    type="text"
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold rounded-xl shadow-lg"
                >
                  {submitting ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESET FACULTY PASSWORD */}
      {resetPassUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" /> Reset Faculty Password
              </h3>
              <button
                onClick={() => setResetPassUser(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                <div className="font-bold text-white text-sm">{resetPassUser.name}</div>
                <div className="text-slate-400">
                  Employee ID: <strong className="text-rcpit-400 font-mono">{resetPassUser.employeeId}</strong> | Email:{' '}
                  {resetPassUser.email}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Enter New Initial Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="New password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 font-mono text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetPassUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg"
                >
                  {submitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
