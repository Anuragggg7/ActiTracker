import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { fetchDepartmentsWithFallback } from '../utils/departments';
import ActionCenter from '../components/ActionCenter';
import CreateActivityModal from '../components/CreateActivityModal';
import PDFViewerModal from '../components/PDFViewerModal';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Award, Building, Users, Calendar, Download, TrendingUp, ShieldCheck, Plus,
  Filter, RefreshCw, AlertTriangle, FileSpreadsheet, Sparkles, CheckCircle2, ChevronRight, Eye
} from 'lucide-react';

const COLORS = ['#0c75eb', '#0059c8', '#3695fa', '#7cb9fd', '#0047a3', '#053c85', '#10b981', '#f59e0b'];

export const DirectorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [deptComp, setDeptComp] = useState([]);
  const [catDist, setCatDist] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [insights, setInsights] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filters State
  const [academicYear, setAcademicYear] = useState('2026–27');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Department Comparison Drawer State
  const [compareDepts, setCompareDepts] = useState({ deptA: '', deptB: '' });
  const [showCompareDrawer, setShowCompareDrawer] = useState(false);

  const [selectedPdfDeptId, setSelectedPdfDeptId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchDepartments = async () => {
    try {
      const list = await fetchDepartmentsWithFallback();
      setDepartmentsList(list || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(false);

      const params = new URLSearchParams();
      if (academicYear) params.append('academicYear', academicYear);
      if (selectedDeptId) params.append('departmentId', selectedDeptId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/analytics/director?${params.toString()}`);
      if (res.success) {
        setStats(res.stats);
        setDeptComp(res.departmentComparison || []);
        setCatDist(res.categoryDistribution || []);
        setMonthlyTrends(res.monthlyTrends || []);
        setInsights(res.insights || []);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [academicYear, selectedDeptId, startDate, endDate]);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academicYear', academicYear);
    if (selectedDeptId) params.append('departmentId', selectedDeptId);
    window.open(`/api/analytics/export?${params.toString()}`, '_blank');
  };

  if (error) {
    return (
      <div className="p-8 text-center glass-card space-y-4 my-8">
        <p className="text-sm font-bold text-rose-600">Unable to load institutional analytics</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-rcpit-600 text-white text-xs font-bold rounded-xl shadow"
        >
          Retry Loading Data
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-rcpit-950 via-rcpit-900 to-indigo-950 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-800">
            Institutional Oversight & Decision Support Platform
          </span>
          <h1 className="text-2xl font-extrabold mt-2">
            Director Executive Operations Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            R. C. Patel Institute of Technology — Real-Time Institutional Intelligence
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl shadow flex items-center gap-1.5 border border-slate-700"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Analytics CSV
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Activity
          </button>
        </div>
      </div>

      {/* GLOBAL FILTER SYSTEM BAR */}
      <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-extrabold">
          <Filter className="w-4 h-4 text-rcpit-600" />
          <span>Global Institutional Filters:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Academic Year Selector */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
            >
              <option value="2026–27">2026–27</option>
              <option value="2025–26">2025–26</option>
              <option value="2024–25">2024–25</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Department</label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
            >
              <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">All Academic Departments</option>
              {departmentsList.map(d => (
                <option key={d._id || d.code} value={d._id || d.code} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-0.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <button
            onClick={fetchAnalytics}
            className="p-2.5 mt-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold hover:bg-slate-200 text-slate-700 dark:text-slate-300"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <ActionCenter />

      {/* RULE-BASED INSIGHT CARDS */}
      {insights.length > 0 && (
        <div className="space-y-3">
          {insights.map((item, idx) => (
            <div key={idx} className={`p-4 rounded-2xl border text-xs flex items-center gap-3 ${
              item.type === 'WARNING'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-900 dark:text-amber-200'
                : 'bg-rcpit-50 dark:bg-rcpit-950/40 border-rcpit-200 text-rcpit-900 dark:text-rcpit-200'
            }`}>
              <Sparkles className="w-5 h-5 shrink-0 text-rcpit-600" />
              <span className="font-extrabold">{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Activities</span>
            <Calendar className="w-4 h-4 text-rcpit-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.totalActivities ?? 0}</p>
        </div>

        <div className="glass-card p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Completed & Verified</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{stats?.completedActivities ?? 0}</p>
        </div>

        <div className="glass-card p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-sky-600 font-bold uppercase tracking-wider">Total Participants</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-black text-sky-600">{stats?.totalParticipants ?? 0}</p>
        </div>

        <div className="glass-card p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-600 font-bold uppercase tracking-wider">Completion Rate</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-600">{stats?.completionRate ?? 0}%</p>
        </div>
      </div>

      {/* INTERACTIVE CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Department Activity Comparison Chart */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-rcpit-600" /> Department Activity Comparison
            </h3>
            <button
              onClick={() => setShowCompareDrawer(true)}
              className="text-xs font-bold text-rcpit-600 hover:underline flex items-center gap-1"
            >
              Side-by-Side Compare <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptComp}>
                <XAxis dataKey="code" stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={11} />
                <Tooltip contentStyle={{ background: '#091e42', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="totalActivities" fill="#0c75eb" radius={[6, 6, 0, 0]} name="Total Activities" />
                <Bar dataKey="completedActivities" fill="#10b981" radius={[6, 6, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Chart */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-rcpit-600" /> Activity Category Distribution
          </h3>

          <div className="h-64 w-full flex items-center justify-center">
            {catDist.length === 0 ? (
              <div className="text-xs text-slate-400">No category activity data for selected filters.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={catDist}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, count }) => count > 0 ? `${name}: ${count}` : ''}
                  >
                    {catDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* DEPARTMENT INSTITUTIONAL PERFORMANCE INDEX TABLE */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
            Institutional Department Performance Index (Formula-Based)
          </h3>
          <span className="text-[10px] text-slate-400 font-bold">
            Score = Completion (30%) + Docs (25%) + Attendance (20%) + Report (15%) + Timely (10%)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="pb-3 px-2">Code</th>
                <th className="pb-3 px-2">Department Name</th>
                <th className="pb-3 px-2">Total Events</th>
                <th className="pb-3 px-2">Completed</th>
                <th className="pb-3 px-2 text-right">Formula Performance Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {deptComp.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-2 font-extrabold text-rcpit-600 dark:text-rcpit-400">{d.code}</td>
                  <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{d.name}</td>
                  <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{d.totalActivities}</td>
                  <td className="py-3 px-2 text-emerald-600 font-bold">{d.completedActivities}</td>
                  <td className="py-3 px-2 text-right font-black">
                    {d.hasData ? (
                      <span className="text-amber-600">{d.performanceScore}%</span>
                    ) : (
                      <span className="text-slate-400 font-normal italic">Insufficient Data</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEPARTMENT SIDE-BY-SIDE COMPARISON DRAWER */}
      {showCompareDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Side-by-Side Department Comparison</h3>
              <button onClick={() => setShowCompareDrawer(false)} className="text-slate-400 hover:text-slate-600">Close</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1">Select Department A</label>
                <select
                  value={compareDepts.deptA}
                  onChange={(e) => setCompareDepts({ ...compareDepts, deptA: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                >
                  <option value="">Select Department</option>
                  {deptComp.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Select Department B</label>
                <select
                  value={compareDepts.deptB}
                  onChange={(e) => setCompareDepts({ ...compareDepts, deptB: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                >
                  <option value="">Select Department</option>
                  {deptComp.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              {['deptA', 'deptB'].map((key) => {
                const dept = deptComp.find(d => d.id === compareDepts[key]);
                if (!dept) return <div key={key} className="p-4 text-center text-slate-400">Select a department above.</div>;
                return (
                  <div key={key} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-2">
                    <h4 className="font-black text-sm text-rcpit-600">{dept.name} ({dept.code})</h4>
                    <p>Total Activities: <strong>{dept.totalActivities}</strong></p>
                    <p>Completed: <strong>{dept.completedActivities}</strong></p>
                    <p>Performance Score: <strong>{dept.hasData ? `${dept.performanceScore}%` : 'Insufficient Data'}</strong></p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <CreateActivityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

    </div>
  );
};

export default DirectorDashboard;
