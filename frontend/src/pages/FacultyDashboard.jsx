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
import {
  Plus, Calendar, CheckSquare, Clock, FileText, QrCode, Download,
  Layers, Search, AlertCircle, ArrowRight, Eye
} from 'lucide-react';

export const FacultyDashboard = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [activities, setActivities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedQrActivity, setSelectedQrActivity] = useState(null);
  const [selectedPdfActivityId, setSelectedPdfActivityId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  // Create Form State
  const [createStep, setCreateStep] = useState(1);
  const [form, setForm] = useState({
    title: '',
    category: 'Workshop',
    description: '',
    objectives: '',
    targetAudience: 'Students & Faculty',
    speakerName: '',
    speakerOrg: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '13:00',
    expectedParticipants: '60',
    estimatedBudget: '5000',
    fundingSource: 'Departmental Budget'
  });

  const fetchMyActivities = async () => {
    try {
      const res = await api.get('/activities');
      if (res.success) {
        setActivities(res.activities || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyActivities();
  }, []);

  const handleCreateSubmit = async (isDraft = false) => {
    try {
      const payload = {
        title: form.title,
        category: form.category,
        description: form.description,
        objectives: form.objectives,
        targetAudience: form.targetAudience,
        guestSpeaker: { name: form.speakerName, organization: form.speakerOrg },
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        expectedParticipants: Number(form.expectedParticipants),
        estimatedBudget: Number(form.estimatedBudget),
        fundingSource: form.fundingSource,
        isDraft
      };

      const res = await api.post('/activities', payload);
      if (res.success) {
        showToast(res.message, 'success');
        setShowCreateModal(false);
        setCreateStep(1);
        fetchMyActivities();
      }
    } catch (err) {
      if (err.isDuplicate) {
        if (window.confirm(`${err.message}\n\nDo you want to proceed creating this activity anyway?`)) {
          // Retry with ignoreDuplicateWarning
          const payload = {
            title: form.title,
            category: form.category,
            description: form.description,
            date: form.date,
            startTime: form.startTime,
            endTime: form.endTime,
            ignoreDuplicateWarning: true,
            isDraft
          };
          const res = await api.post('/activities', payload);
          if (res.success) {
            showToast(res.message, 'success');
            setShowCreateModal(false);
            fetchMyActivities();
          }
        }
      } else {
        showToast(err.message || 'Failed to create activity', 'error');
      }
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
          {user?.facultyEmployeeId && (
            <p className="text-[10px] text-slate-400 mt-1">
              🔒 This Faculty / Employee ID is permanently assigned to your account and cannot be changed.
            </p>
          )}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-3 bg-rcpit-500 hover:bg-rcpit-400 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 self-start md:self-auto transition-all"
        >
          <Plus className="w-4 h-4" /> Create New Activity
        </button>
      </div>

      {/* Action Center Widget */}
      <ActionCenter />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Activities</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{activities.length}</p>
        </div>
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-amber-600 font-bold uppercase tracking-wider">Pending Approvals</span>
          <p className="text-2xl font-black text-amber-600">
            {activities.filter(a => ['SUBMITTED', 'HOD_REVIEW', 'ADMIN_REVIEW', 'SLOT_REQUESTED'].includes(a.status)).length}
          </p>
        </div>
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-sky-600 font-bold uppercase tracking-wider">Scheduled Events</span>
          <p className="text-2xl font-black text-sky-600">
            {activities.filter(a => a.status === 'SCHEDULED').length}
          </p>
        </div>
        <div className="glass-card p-5 space-y-1">
          <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Completed & Archived</span>
          <p className="text-2xl font-black text-emerald-600">
            {activities.filter(a => ['COMPLETED', 'ARCHIVED'].includes(a.status)).length}
          </p>
        </div>
      </div>

      {/* Activities Table */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-rcpit-600" /> My Activity Lifecycle Records
          </h3>

          {/* Activity Section Search Bar */}
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
                  <th className="pb-3 px-2">Date & Venue</th>
                  <th className="pb-3 px-2">Lifecycle Status</th>
                  <th className="pb-3 px-2">Doc Score</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredActivities.map((act) => (
                  <tr key={act._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-2 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                      {act.title}
                    </td>
                    <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400">
                      {act.category}
                    </td>
                    <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400">
                      <div>{new Date(act.date).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400">{act.venueName || 'TBD'}</div>
                    </td>
                    <td className="py-3.5 px-2">
                      <StatusBadge status={act.status} />
                    </td>
                    <td className="py-3.5 px-2 font-bold text-rcpit-600">
                      {act.documentationScore}%
                    </td>
                    <td className="py-3.5 px-2 text-right space-x-1">
                      <Link
                        to={`/faculty/activities/${act._id}`}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rcpit-50 text-slate-600 dark:text-slate-300 inline-flex items-center"
                        title="View Digital Album & Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => setSelectedQrActivity(act)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rcpit-50 text-slate-600 dark:text-slate-300"
                        title="Show Verification QR Code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSelectedPdfActivityId(act._id)}
                        className="p-1.5 rounded-lg bg-rcpit-50 text-rcpit-600 dark:bg-rcpit-950 dark:text-rcpit-400 font-bold"
                        title="Generate Event PDF Report"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {/* Universal Photo & Video Activity Creation Modal */}
      <CreateActivityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchMyActivities}
      />

    </div>
  );
};

export default FacultyDashboard;
