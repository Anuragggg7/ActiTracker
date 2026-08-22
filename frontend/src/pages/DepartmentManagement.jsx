import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Building, Plus, Search, Award, Users, CheckCircle, RefreshCw } from 'lucide-react';
import { fetchDepartmentsWithFallback } from '../utils/departments';

export const DepartmentManagement = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [departments, setDepartments] = useState([]);
  const [hods, setHods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newDept, setNewDept] = useState({ name: '', code: '', hodId: '' });

  const fetchDeptData = async () => {
    try {
      setLoading(true);
      const [deptsList, userRes] = await Promise.all([
        fetchDepartmentsWithFallback(),
        api.get('/users?role=HOD').catch(() => ({ success: false }))
      ]);

      setDepartments(deptsList || []);
      if (userRes && userRes.success) setHods(userRes.users || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch department data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeptData();
  }, []);

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    if (!newDept.name || !newDept.code) {
      showToast('Please enter department name and code', 'warning');
      return;
    }
    try {
      const res = await api.post('/departments', newDept);
      if (res.success) {
        showToast(res.message || 'Department created successfully', 'success');
        setShowAddModal(false);
        setNewDept({ name: '', code: '', hodId: '' });
        fetchDeptData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create department', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-rcpit-950 via-rcpit-900 to-rcpit-800 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300 bg-cyan-950/80 px-3 py-1 rounded-full border border-cyan-800">
            Institutional Administration
          </span>
          <h1 className="text-2xl font-extrabold mt-2 flex items-center gap-2">
            <Building className="w-6 h-6 text-cyan-400" /> Academic Department & HOD Management
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Governance of institutional academic units, HOD appointments & performance benchmarking
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 self-start md:self-auto transition-all"
          >
            <Plus className="w-4 h-4" /> Add Academic Department
          </button>
        )}
      </div>

      {/* Department Cards Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading department master records...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div key={dept._id} className="glass-card p-6 space-y-4 relative overflow-hidden group hover:border-rcpit-500 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-rcpit-50 text-rcpit-600 dark:bg-slate-800 dark:text-rcpit-400 uppercase">
                    Code: {dept.code}
                  </span>
                  <h3 className="font-black text-base text-slate-900 dark:text-white mt-2">
                    {dept.name}
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 font-extrabold text-sm">
                  {dept.performanceScore ?? 0}%
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 space-y-1 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Head of Department (HOD)</span>
                <p className="font-extrabold text-slate-800 dark:text-slate-200">
                  {dept.hodId?.name || 'No HOD Assigned'}
                </p>
                <p className="text-[11px] text-slate-500">{dept.hodId?.email || 'Assign an HOD via Admin'}</p>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span>Faculty Members: {dept.facultyCount ?? 0}</span>
                <span className="font-bold text-emerald-600">Active Governance</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Create New Department</h3>
            <form onSubmit={handleCreateDepartment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Department Name</label>
                <input
                  type="text" required placeholder="e.g. Robotics & Automation"
                  value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Department Code</label>
                <input
                  type="text" required placeholder="e.g. MTRX"
                  value={newDept.code} onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Assign HOD</label>
                <select
                  value={newDept.hodId} onChange={(e) => setNewDept({ ...newDept, hodId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="">Select HOD Account</option>
                  {hods.map(h => <option key={h._id} value={h._id}>{h.name} ({h.email})</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-rcpit-600 text-white font-bold rounded-xl shadow">Save Department</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default DepartmentManagement;
