import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { getApiUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import StatusBadge from '../components/StatusBadge';
import CompletenessScoreWidget from '../components/CompletenessScoreWidget';
import QRCodeModal from '../components/QRCodeModal';
import PDFViewerModal from '../components/PDFViewerModal';
import {
  ArrowLeft, Calendar, MapPin, Clock, Users, DollarSign, FileText,
  Camera, Video, Upload, Download, QrCode, CheckCircle, AlertTriangle, Lock,
  ShieldCheck, Award, MessageSquare, History, Plus, RefreshCw, Star, Trash2, Check, X, FileSpreadsheet, Eye, Play
} from 'lucide-react';

export const ActivityDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [activity, setActivity] = useState(null);
  const [media, setMedia] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [attendance, setAttendance] = useState({ records: [], stats: { total: 0, present: 0, absent: 0, percentage: 0 } });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('overview');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Lightbox Media Viewer State
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(null);

  // Upload Media Modal State
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaType, setMediaType] = useState('IMAGE');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Media Rejection Reason Modal
  const [rejectingMediaId, setRejectingMediaId] = useState(null);
  const [mediaRejectReason, setMediaRejectReason] = useState('');

  // Upload Document State
  const [showDocModal, setShowDocModal] = useState(false);
  const [docType, setDocType] = useState('EVENT_REPORT');
  const [docFile, setDocFile] = useState(null);
  const [docDescription, setDocDescription] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Add Attendance Participant State
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    participantName: '', participantId: '', department: '', participantType: 'STUDENT', email: '', attendanceStatus: 'PRESENT'
  });
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  // Post-Event Report Form State
  const [reportForm, setReportForm] = useState({
    actualParticipants: 0,
    keyHighlights: '',
    outcomes: '',
    achievements: '',
    feedback: '',
    conclusion: '',
    recommendations: '',
    reportFile: ''
  });
  const [submittingReport, setSubmittingReport] = useState(false);

  // Budget Form State (Requirement 9)
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    estimatedBudget: 0,
    approvedBudget: 0,
    actualExpenditure: 0,
    fundingSource: 'Departmental Budget',
    budgetStatus: 'PROPOSED',
    budgetCategories: []
  });
  const [submittingBudget, setSubmittingBudget] = useState(false);

  // Approvals Audit Trail
  const [approvals, setApprovals] = useState([]);

  // HOD Review Notes
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewActioning, setReviewActioning] = useState(false);

  const fetchActivityData = async () => {
    if (!id || id === 'undefined') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [actRes, mediaRes, docRes, attRes, repRes] = await Promise.all([
        api.get(`/activities/${id}`),
        api.get(`/activities/${id}/media`),
        api.get(`/activities/${id}/documents`),
        api.get(`/activities/${id}/attendance`),
        api.get(`/activities/${id}/report`)
      ]);

      if (actRes.success && actRes.activity) {
        setActivity(actRes.activity);
        setBudgetForm({
          estimatedBudget: actRes.activity.estimatedBudget || 0,
          approvedBudget: actRes.activity.approvedBudget || 0,
          actualExpenditure: actRes.activity.actualExpenditure || 0,
          fundingSource: actRes.activity.fundingSource || 'Departmental Budget',
          budgetStatus: actRes.activity.budgetStatus || 'PROPOSED',
          budgetCategories: actRes.activity.budgetCategories || []
        });
        if (actRes.approvals) setApprovals(actRes.approvals);
      }
      if (mediaRes.success) setMedia(mediaRes.media || []);
      if (docRes.success) setDocuments(docRes.documents || []);
      if (attRes.success) setAttendance(attRes);
      if (repRes.success && repRes.report) {
        setReport(repRes.report);
        setReportForm({
          actualParticipants: repRes.report.actualParticipants || actRes.activity?.expectedParticipants || 0,
          keyHighlights: repRes.report.keyHighlights || '',
          outcomes: repRes.report.outcomes || '',
          achievements: repRes.report.achievements || '',
          feedback: repRes.report.feedback || '',
          conclusion: repRes.report.conclusion || '',
          recommendations: repRes.report.recommendations || '',
          reportFile: repRes.report.reportFile || ''
        });
      } else if (actRes.activity) {
        setReportForm(prev => ({ ...prev, actualParticipants: actRes.activity.expectedParticipants || 0 }));
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch activity details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetUpdate = async (e) => {
    e.preventDefault();
    try {
      setSubmittingBudget(true);
      const res = await api.put(`/activities/${id}/budget`, budgetForm);
      if (res.success) {
        showToast(res.message || 'Budget updated successfully', 'success');
        setShowBudgetModal(false);
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update budget', 'error');
    } finally {
      setSubmittingBudget(false);
    }
  };

  useEffect(() => {
    fetchActivityData();
  }, [id]);

  // Upload Media Handler (Images or Video)
  const handleMediaUpload = async (e) => {
    e.preventDefault();
    if (!mediaFiles || mediaFiles.length === 0) {
      showToast('Please select file(s) to upload', 'warning');
      return;
    }
    try {
      setUploadingMedia(true);
      const formData = new FormData();
      formData.append('caption', mediaCaption || mediaFiles[0].name);

      if (mediaType === 'IMAGE') {
        Array.from(mediaFiles).forEach(file => formData.append('images', file));
        const res = await api.post(`/activities/${id}/media/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.success) showToast(res.message || 'Images uploaded successfully', 'success');
      } else {
        formData.append('video', mediaFiles[0]);
        const res = await api.post(`/activities/${id}/media/videos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.success) showToast(res.message || 'Video uploaded successfully', 'success');
      }

      setShowMediaModal(false);
      setMediaFiles([]);
      setMediaCaption('');
      fetchActivityData();
    } catch (err) {
      showToast(err.message || 'Media upload failed', 'error');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Verify Media Handler (HOD)
  const handleVerifyMedia = async (mediaId, status, rejectionReason = '') => {
    try {
      const res = await api.put(`/media/${mediaId}/verify`, { status, rejectionReason });
      if (res.success) {
        showToast(res.message, 'success');
        setRejectingMediaId(null);
        setMediaRejectReason('');
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'Media verification failed', 'error');
    }
  };

  // Delete Media
  const handleDeleteMedia = async (mediaId) => {
    if (!window.confirm('Are you sure you want to delete this media file?')) return;
    try {
      const res = await api.delete(`/media/${mediaId}`);
      if (res.success) {
        showToast('Media removed', 'success');
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete media', 'error');
    }
  };

  // Upload Document Handler (With Versioning)
  const handleDocUpload = async (e) => {
    e.preventDefault();
    if (!docFile) {
      showToast('Please select a document file to upload', 'warning');
      return;
    }
    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('documentType', docType);
      formData.append('description', docDescription);

      const res = await api.post(`/activities/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.success) {
        showToast(res.message || 'Document uploaded successfully', 'success');
        setShowDocModal(false);
        setDocFile(null);
        setDocDescription('');
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'Document upload failed', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Attendance Handlers
  const handleAddParticipant = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/activities/${id}/attendance`, newParticipant);
      if (res.success) {
        showToast('Participant added to attendance register', 'success');
        setShowAddParticipantModal(false);
        setNewParticipant({ participantName: '', participantId: '', department: '', participantType: 'STUDENT', email: '', attendanceStatus: 'PRESENT' });
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to add participant', 'error');
    }
  };

  const handleToggleAttendanceStatus = async (recordId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
      const res = await api.put(`/attendance/${recordId}`, { attendanceStatus: newStatus });
      if (res.success) {
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleRemoveParticipant = async (recordId) => {
    try {
      const res = await api.delete(`/attendance/${recordId}`);
      if (res.success) {
        showToast('Participant removed', 'success');
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to remove participant', 'error');
    }
  };

  const handleImportCsv = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    try {
      const res = await api.post(`/activities/${id}/attendance/import`, { csvText });
      if (res.success) {
        showToast(res.message, 'success');
        setShowCsvImportModal(false);
        setCsvText('');
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'CSV import failed', 'error');
    }
  };

  const handleExportCsv = () => {
    window.open(getApiUrl(`/api/activities/${id}/attendance/export`), '_blank');
  };

  // Post-Event Report Submit
  const handleReportSubmit = async (e, isDraft = false) => {
    if (e) e.preventDefault();
    try {
      setSubmittingReport(true);
      const res = await api.post(`/activities/${id}/report`, {
        ...reportForm,
        isDraft
      });
      if (res.success) {
        showToast(res.message, 'success');
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'Report action failed', 'error');
    } finally {
      setSubmittingReport(false);
    }
  };

  // HOD Report Review
  const handleReportVerify = async (action) => {
    try {
      setReviewActioning(true);
      const res = await api.put(`/activities/${id}/report/verify`, {
        action,
        notes: reviewNotes
      });
      if (res.success) {
        showToast(res.message, 'success');
        setReviewNotes('');
        fetchActivityData();
      }
    } catch (err) {
      showToast(err.message || 'Report review failed', 'error');
    } finally {
      setReviewActioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-rcpit-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Loading Institutional Activity Record...
        </p>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-16 space-y-4 glass-card my-8">
        <p className="text-sm font-bold text-slate-600">Activity record not found or inaccessible.</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-rcpit-600 text-white rounded-xl text-xs font-bold">
          Go Back
        </button>
      </div>
    );
  }

  const isHodOrAdmin = ['HOD', 'ADMIN'].includes(user?.role);
  const isCoordinator = user?._id === (activity.coordinatorId?._id || activity.coordinatorId);

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-600 dark:text-slate-400 hover:text-rcpit-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQrModal(true)}
            className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-extrabold flex items-center gap-2 text-slate-700 dark:text-slate-300 shadow-sm hover:border-rcpit-500"
          >
            <QrCode className="w-4 h-4 text-rcpit-600" /> Verification QR
          </button>

          {report?.status === 'VERIFIED' || ['COMPLETED', 'ARCHIVED'].includes(activity?.status) ? (
            <button
              onClick={() => setShowPdfModal(true)}
              className="px-4 py-2.5 bg-rcpit-600 hover:bg-rcpit-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md"
            >
              <Download className="w-4 h-4" /> Generate Official PDF
            </button>
          ) : (
            <div className="relative group">
              <button
                disabled
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-not-allowed"
              >
                <Lock className="w-4 h-4 text-slate-400" /> Generate Official PDF
              </button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-30 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg shadow-lg whitespace-nowrap">
                Official PDF will be available after HOD verification.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Activity Header Banner */}
      <div className="glass-card p-6 md:p-8 space-y-6 relative overflow-hidden">
        {activity.isLocked && (
          <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[10px] uppercase px-4 py-1 rounded-bl-xl flex items-center gap-1 shadow">
            <Lock className="w-3 h-3" /> Historical Record Locked
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={activity.status} />
              <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {activity.category}
              </span>
              <span className="text-xs font-bold text-rcpit-600 dark:text-rcpit-400">
                {activity.departmentId?.name}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
              {activity.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Coordinator: <span className="font-bold text-slate-800 dark:text-slate-200">{activity.coordinatorId?.name}</span> ({activity.coordinatorId?.designation})
            </p>
          </div>

          <CompletenessScoreWidget
            score={activity.documentationScore || 0}
            checklist={[
              { label: 'Activity Created & Proposed', done: true },
              { label: 'HOD Department Review & Forwarded', done: ['ADMIN_REVIEW', 'ADMIN_APPROVED', 'HOD_APPROVED', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED'].includes(activity.status) },
              { label: 'Admin Institutional Final Approval', done: ['ADMIN_APPROVED', 'HOD_APPROVED', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED'].includes(activity.status) },
              { label: 'Slot Allocation Confirmed', done: ['SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED'].includes(activity.status) },
              { label: 'Attendance Records Logged', done: attendance.stats.total > 0 },
              { label: 'Geo-Tagged Photographs Uploaded', done: media.some(m => m.mediaType?.toUpperCase() === 'IMAGE') },
              { label: 'Verified Event Report Uploaded', done: report?.status === 'VERIFIED' || activity.status === 'COMPLETED' }
            ]}
          />
        </div>

        {/* Quick Meta Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rcpit-50 dark:bg-rcpit-950 text-rcpit-600">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Date & Time</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {new Date(activity.date).toLocaleDateString()} ({activity.startTime} - {activity.endTime})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Assigned Venue</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {activity.venueName || activity.venueId?.name || 'Venue Not Assigned'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Target Attendees</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {activity.expectedParticipants} Attendees ({activity.targetAudience})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Estimated Budget</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                ₹{activity.estimatedBudget?.toLocaleString()} ({activity.fundingSource})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Overview & Details', icon: FileText },
          { id: 'timeline', label: 'Timeline', icon: History },
          { id: 'budget', label: 'Financial Budget', icon: DollarSign },
          { id: 'media', label: `Digital Album (${media.length})`, icon: Camera },
          { id: 'documents', label: `Documents (${documents.length})`, icon: FileText },
          { id: 'attendance', label: `Attendance (${attendance.stats.total})`, icon: Users },
          { id: 'report', label: 'Post-Event Report', icon: Award },
          { id: 'approvals', label: 'Workflow Logs', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-rcpit-600 text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Activity Objectives & Scope
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {activity.description || 'No detailed objectives provided.'}
            </p>
          </div>

          <div className="glass-card p-6 space-y-4 text-xs">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Resource Requirements
            </h3>
            <div className="space-y-2 text-slate-600 dark:text-slate-400">
              <p>• Audio Visual System: <strong className="text-slate-800 dark:text-slate-200">Required</strong></p>
              <p>• High-Speed Wi-Fi / LAN: <strong className="text-slate-800 dark:text-slate-200">Required</strong></p>
              <p>• Certificate Generation: <strong className="text-slate-800 dark:text-slate-200">Enabled</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* TAB: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="glass-card p-6 md:p-8 space-y-6">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-rcpit-600" /> Milestone Lifecycle Progression
          </h3>

          <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-8 my-4">
            {[
              { title: 'Activity Proposal Submitted', done: true },
              { title: 'HOD Department Review & Forwarded', done: ['ADMIN_REVIEW', 'ADMIN_APPROVED', 'HOD_APPROVED', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED'].includes(activity.status) },
              { title: 'Admin Final Institutional Approval', done: ['ADMIN_APPROVED', 'HOD_APPROVED', 'SLOT_REQUESTED', 'SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED'].includes(activity.status) },
              { title: 'Venue Slot Allocated', done: ['SLOT_APPROVED', 'SCHEDULED', 'CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED'].includes(activity.status) },
              { title: 'Event Conducted', done: ['CONDUCTED', 'REPORT_PENDING', 'VERIFICATION', 'COMPLETED'].includes(activity.status) },
              { title: 'Post-Event Report Submitted', done: ['VERIFICATION', 'COMPLETED'].includes(activity.status) },
              { title: 'HOD Report Verified & Activity Completed', done: activity.status === 'COMPLETED' }
            ].map((step, idx) => (
              <div key={idx} className="relative">
                <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 ${
                  step.done ? 'bg-rcpit-600 border-rcpit-600 shadow' : 'bg-slate-200 border-slate-300'
                }`} />
                <h4 className={`text-xs font-extrabold ${step.done ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                  {step.title}
                </h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: BUDGET (Requirement 9) */}
      {activeTab === 'budget' && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" /> Activity Financial & Expenditure Record
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Stored directly in MongoDB master database record.
                </p>
              </div>

              {['HOD', 'ADMIN', 'FACULTY'].includes(user?.role) && !activity.isLocked && (
                <button
                  onClick={() => setShowBudgetModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto"
                >
                  Manage / Update Budget
                </button>
              )}
            </div>

            {/* Budget Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estimated Budget</span>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  ₹{activity.estimatedBudget?.toLocaleString() || 0}
                </p>
                <span className="text-[10px] text-slate-400 block">{activity.fundingSource || 'Departmental'}</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 space-y-1">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Approved Budget</span>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{activity.approvedBudget?.toLocaleString() || 0}
                </p>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold block uppercase">
                  Status: {activity.budgetStatus || 'PROPOSED'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 space-y-1">
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Actual Expenditure</span>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                  ₹{activity.actualExpenditure?.toLocaleString() || 0}
                </p>
                <span className="text-[10px] text-slate-400 block">Logged Expenses</span>
              </div>

              <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/60 space-y-1">
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">Remaining Balance</span>
                <p className="text-xl font-black text-sky-600 dark:text-sky-400">
                  ₹{((activity.approvedBudget || activity.estimatedBudget || 0) - (activity.actualExpenditure || 0)).toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-400 block">Available Funds</span>
              </div>
            </div>

            {/* Category Expenses Breakdown */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Expense Head Breakdowns
              </h4>
              {!activity.budgetCategories || activity.budgetCategories.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">No itemized expense heads logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px]">
                        <th className="pb-2 px-2">Expense Category</th>
                        <th className="pb-2 px-2">Estimated (₹)</th>
                        <th className="pb-2 px-2">Actual (₹)</th>
                        <th className="pb-2 px-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activity.budgetCategories.map((cat, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-2 font-bold text-slate-900 dark:text-white">{cat.categoryName}</td>
                          <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">₹{cat.estimatedAmount?.toLocaleString()}</td>
                          <td className="py-2.5 px-2 font-bold text-emerald-600">₹{cat.actualAmount?.toLocaleString()}</td>
                          <td className="py-2.5 px-2 text-slate-400">{cat.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: MEDIA (DIGITAL ALBUM) */}
      {activeTab === 'media' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Institutional Digital Event Album ({media.length})
            </h3>
            {user?.role !== 'DIRECTOR' && (
              <button
                onClick={() => setShowMediaModal(true)}
                className="px-4 py-2.5 bg-rcpit-600 text-white rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow"
              >
                <Plus className="w-4 h-4" /> Upload Photos / Video
              </button>
            )}
          </div>

          {media.length === 0 ? (
            <div className="glass-card p-12 text-center text-xs text-slate-400">
              No media uploaded yet for this activity.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {media.map((m, idx) => (
                <div key={m._id} className="glass-card overflow-hidden group relative flex flex-col justify-between">
                  <div className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => setSelectedMediaIndex(idx)}>
                    {m.mediaType?.toUpperCase() === 'VIDEO' ? (
                      <div className="flex flex-col items-center gap-2 text-white">
                        <Video className="w-8 h-8 text-rcpit-400" />
                        <span className="text-[10px] font-bold">Play Video</span>
                      </div>
                    ) : (
                      <img src={getApiUrl(m.fileUrl)} alt={m.caption} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                    )}

                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                      m.verificationStatus === 'VERIFIED' ? 'bg-emerald-600 text-white' :
                      m.verificationStatus === 'REJECTED' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'
                    }`}>
                      {m.verificationStatus}
                    </span>
                  </div>

                  <div className="p-3 text-xs space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{m.caption || 'Event Media'}</p>

                    {m.rejectionReason && (
                      <p className="text-[10px] text-rose-500 font-medium">Rejection Reason: {m.rejectionReason}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</span>
                      
                      <div className="flex items-center gap-1">
                        {isHodOrAdmin && m.verificationStatus === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleVerifyMedia(m._id, 'VERIFIED')}
                              className="p-1 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200"
                              title="Verify Media"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setRejectingMediaId(m._id)}
                              className="p-1 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200"
                              title="Reject Media"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {(isHodOrAdmin || m.uploadedBy?._id === user?._id) && (
                          <button
                            onClick={() => handleDeleteMedia(m._id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          
          {/* Section A: Generated Official Institutional Reports */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-rcpit-600" /> Generated Official Institutional Reports
                </h3>
                <p className="text-[11px] text-slate-400">Official accreditation-ready PDF records with institutional versioning</p>
              </div>

              {(report?.status === 'VERIFIED' || ['COMPLETED', 'ARCHIVED'].includes(activity?.status)) && (
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="px-3.5 py-2 bg-rcpit-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" /> Generate New Version
                </button>
              )}
            </div>

            {documents.filter(d => d.documentType === 'GENERATED_ACTIVITY_REPORT').length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No official PDF reports generated yet. Click "Generate Official PDF" after HOD verification.
              </div>
            ) : (
              <div className="space-y-3">
                {documents.filter(d => d.documentType === 'GENERATED_ACTIVITY_REPORT').map((doc) => (
                  <div key={doc._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 font-extrabold">
                        PDF
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white">{doc.fileName}</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                            v{doc.version} (Official)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Generated by <strong>{doc.uploadedBy?.name || 'System'}</strong> on {new Date(doc.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPdfModal(true)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl flex items-center gap-1.5 hover:border-rcpit-500"
                      >
                        <Eye className="w-3.5 h-3.5 text-rcpit-600" /> Preview
                      </button>
                      <a
                        href={getApiUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer"
                        className="px-3.5 py-1.5 bg-rcpit-600 text-white font-bold rounded-xl flex items-center gap-1.5 shadow"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Uploaded Attachments & Supporting Documents */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Uploaded Attachments & Supporting Documents ({documents.filter(d => d.documentType !== 'GENERATED_ACTIVITY_REPORT').length})
              </h3>
              {user?.role !== 'DIRECTOR' && (
                <button
                  onClick={() => setShowDocModal(true)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-extrabold flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Upload Attachment
                </button>
              )}
            </div>

            {documents.filter(d => d.documentType !== 'GENERATED_ACTIVITY_REPORT').length === 0 ? (
              <div className="glass-card p-8 text-center text-xs text-slate-400">
                No supporting documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {documents.filter(d => d.documentType !== 'GENERATED_ACTIVITY_REPORT').map((doc) => (
                  <div key={doc._id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-rcpit-50 dark:bg-slate-800 text-rcpit-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white">{doc.documentType}</span>
                          <span className="px-2 py-0.5 rounded-full bg-rcpit-100 text-rcpit-800 text-[10px] font-bold">
                            v{doc.version}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Uploaded by <strong>{doc.uploadedBy?.name || 'Coordinator'}</strong> on {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <a
                        href={getApiUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-200"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Registered</span>
              <p className="text-xl font-black text-slate-900 dark:text-white">{attendance.stats.total}</p>
            </div>
            <div className="glass-card p-4 space-y-1">
              <span className="text-[10px] text-emerald-600 font-bold uppercase">Present</span>
              <p className="text-xl font-black text-emerald-600">{attendance.stats.present}</p>
            </div>
            <div className="glass-card p-4 space-y-1">
              <span className="text-[10px] text-rose-600 font-bold uppercase">Absent</span>
              <p className="text-xl font-black text-rose-600">{attendance.stats.absent}</p>
            </div>
            <div className="glass-card p-4 space-y-1">
              <span className="text-[10px] text-rcpit-600 font-bold uppercase">Attendance %</span>
              <p className="text-xl font-black text-rcpit-600">{attendance.stats.percentage}%</p>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              Participant Attendance Register
            </h3>

            <div className="flex gap-2">
              <button onClick={handleExportCsv} className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export CSV
              </button>
              {user?.role !== 'DIRECTOR' && (
                <>
                  <button onClick={() => setShowCsvImportModal(true)} className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-sky-600" /> Import CSV
                  </button>
                  <button onClick={() => setShowAddParticipantModal(true)} className="px-4 py-2 bg-rcpit-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow">
                    <Plus className="w-4 h-4" /> Add Participant
                  </button>
                </>
              )}
            </div>
          </div>

          {attendance.records.length === 0 ? (
            <div className="glass-card p-12 text-center text-xs text-slate-400">
              No attendance recorded yet for this activity.
            </div>
          ) : (
            <div className="glass-card p-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px]">
                    <th className="pb-3 px-2">Sr. No.</th>
                    <th className="pb-3 px-2">Participant Name</th>
                    <th className="pb-3 px-2">ID / PRN</th>
                    <th className="pb-3 px-2">Department</th>
                    <th className="pb-3 px-2">Type</th>
                    <th className="pb-3 px-2">Status</th>
                    <th className="pb-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {attendance.records.map((r, idx) => (
                    <tr key={r._id}>
                      <td className="py-3 px-2 font-bold text-slate-500 dark:text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{r.participantName}</td>
                      <td className="py-3 px-2 text-slate-500">{r.participantId || 'N/A'}</td>
                      <td className="py-3 px-2 text-slate-500">{r.department}</td>
                      <td className="py-3 px-2 font-semibold text-rcpit-600">{r.participantType}</td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => handleToggleAttendanceStatus(r._id, r.attendanceStatus)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            r.attendanceStatus === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.attendanceStatus}
                        </button>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button onClick={() => handleRemoveParticipant(r._id)} className="text-slate-400 hover:text-rose-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: POST-EVENT REPORT */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="glass-card p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-rcpit-600" /> Post-Event Report Verification
                </h3>
                <p className="text-xs text-slate-400">Institutional summary of outcomes, key highlights & participant feedback</p>
              </div>

              {report && (
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                  report.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                  report.status === 'CHANGES_REQUIRED' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                }`}>
                  Report Status: {report.status}
                </span>
              )}
            </div>

            {/* HOD Review Box */}
            {isHodOrAdmin && report?.status === 'SUBMITTED' && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3">
                <h4 className="font-extrabold text-xs text-amber-900 dark:text-amber-300">HOD Verification Action Required</h4>
                <textarea
                  placeholder="Enter feedback, verification notes or change request details..."
                  value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
                <div className="flex gap-2">
                  <button onClick={() => handleReportVerify('APPROVE')} disabled={reviewActioning} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow">
                    Approve & Verify Report
                  </button>
                  <button onClick={() => handleReportVerify('REQUEST_CHANGES')} disabled={reviewActioning} className="px-4 py-2 bg-amber-600 text-white font-bold rounded-xl text-xs shadow">
                    Request Changes
                  </button>
                  <button onClick={() => handleReportVerify('REJECT')} disabled={reviewActioning} className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs shadow">
                    Reject Report
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={(e) => handleReportSubmit(e, false)} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Actual Participant Count</label>
                  <input
                    type="number" required
                    value={reportForm.actualParticipants} onChange={(e) => setReportForm({ ...reportForm, actualParticipants: Number(e.target.value) })}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Key Highlights</label>
                  <input
                    type="text" placeholder="e.g. Hands-on IoT hardware coding session"
                    value={reportForm.keyHighlights} onChange={(e) => setReportForm({ ...reportForm, keyHighlights: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Learning Outcomes & Achievements</label>
                <textarea
                  rows="3" placeholder="Enter key outcomes..."
                  value={reportForm.outcomes} onChange={(e) => setReportForm({ ...reportForm, outcomes: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              {user?.role !== 'DIRECTOR' && report?.status !== 'VERIFIED' && (
                <div className="flex gap-2 justify-end pt-3">
                  <button type="button" onClick={(e) => handleReportSubmit(e, true)} disabled={submittingReport} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl text-slate-700 dark:text-slate-300">
                    Save Draft
                  </button>
                  <button type="submit" disabled={submittingReport} className="px-5 py-2.5 bg-rcpit-600 text-white font-extrabold rounded-xl shadow">
                    Submit Report for Verification
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* TAB: APPROVALS & WORKFLOW */}
      {activeTab === 'approvals' && (
        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Institutional Approval & Governance Audit Trail
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Chronological record of proposal reviews, HOD endorsements, and Admin approvals.</p>
            </div>
            <span className="text-xs font-bold text-rcpit-600 bg-rcpit-50 dark:bg-rcpit-950 px-3 py-1 rounded-full border border-rcpit-200 dark:border-rcpit-800">
              {approvals.length} Record(s) Logged
            </span>
          </div>

          {approvals.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No formal governance approval events logged yet for this proposal.
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map((app, idx) => (
                <div key={app._id || idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                        {app.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(app.timestamp || app.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">
                      Action Performed By: <strong className="text-slate-800 dark:text-slate-200">{app.performedBy?.name || 'User'}</strong> ({app.role || app.performedBy?.role})
                    </p>
                    {app.comments && (
                      <p className="mt-1 text-slate-500 italic bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                        "{app.comments}"
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      {app.previousStatus ? `${app.previousStatus} → ` : ''}{app.newStatus || app.action}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Media Modal */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Upload Activity Photos / Videos</h3>
            <form onSubmit={handleMediaUpload} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Media Type</label>
                <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <option value="IMAGE">Photos (JPG, PNG, WEBP)</option>
                  <option value="VIDEO">Video (MP4, WEBM, MOV)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Select File(s)</label>
                <input type="file" multiple={mediaType === 'IMAGE'} onChange={(e) => setMediaFiles(e.target.files)} className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border" />
              </div>
              <div>
                <label className="block font-bold mb-1">Caption / Description</label>
                <input type="text" placeholder="e.g. Keynote inauguration speech" value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowMediaModal(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">Cancel</button>
                <button type="submit" disabled={uploadingMedia} className="px-5 py-2 bg-rcpit-600 text-white font-bold rounded-xl shadow">Upload</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Upload Activity Document</h3>
            <form onSubmit={handleDocUpload} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Document Type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border">
                  <option value="PERMISSION_LETTER">Permission Letter</option>
                  <option value="INVITATION">Invitation Card</option>
                  <option value="ATTENDANCE">Attendance Sheet</option>
                  <option value="CERTIFICATE">Certificates</option>
                  <option value="EVENT_REPORT">Event Report Document</option>
                  <option value="POSTER">Posters & Banners</option>
                  <option value="SUPPORTING_DOCUMENT">Supporting Document</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Select File (PDF, DOCX, XLSX, PPTX)</label>
                <input type="file" onChange={(e) => setDocFile(e.target.files[0])} className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border" />
              </div>
              <div>
                <label className="block font-bold mb-1">Description / Notes</label>
                <input type="text" placeholder="e.g. Revised event schedule v2" value={docDescription} onChange={(e) => setDocDescription(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDocModal(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">Cancel</button>
                <button type="submit" disabled={uploadingDoc} className="px-5 py-2 bg-rcpit-600 text-white font-bold rounded-xl shadow">Upload Document</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Participant Modal */}
      {showAddParticipantModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Add Participant to Register</h3>
            <form onSubmit={handleAddParticipant} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Full Name</label>
                <input type="text" required value={newParticipant.participantName} onChange={(e) => setNewParticipant({ ...newParticipant, participantName: e.target.value })} className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Participant ID / PRN</label>
                  <input type="text" value={newParticipant.participantId} onChange={(e) => setNewParticipant({ ...newParticipant, participantId: e.target.value })} className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border" />
                </div>
                <div>
                  <label className="block font-bold mb-1">Type</label>
                  <select value={newParticipant.participantType} onChange={(e) => setNewParticipant({ ...newParticipant, participantType: e.target.value })} className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border">
                    <option value="STUDENT">Student</option>
                    <option value="FACULTY">Faculty</option>
                    <option value="EXTERNAL">External</option>
                    <option value="GUEST">Guest</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddParticipantModal(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-rcpit-600 text-white font-bold rounded-xl shadow">Save Participant</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Import Attendance via CSV</h3>
            <p className="text-slate-500">Paste CSV data. Formats with or without Sr. No. are supported: <code>[Sr. No], Name, PRN/ID, Department, Type, Email, Status</code></p>
            <form onSubmit={handleImportCsv} className="space-y-3">
              <textarea rows="6" placeholder="Sr. No, Name, ID, Department, Type, Email, Status&#10;1, John Doe, 202601, Computer, STUDENT, john@rcpit.ac.in, PRESENT" value={csvText} onChange={(e) => setCsvText(e.target.value)} className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border font-mono text-[11px]" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCsvImportModal(false)} className="px-4 py-2 bg-slate-100 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-rcpit-600 text-white font-bold rounded-xl shadow">Import Records</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Lightbox Viewer Modal */}
      {selectedMediaIndex !== null && media[selectedMediaIndex] && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
            <button onClick={() => setSelectedMediaIndex(null)} className="absolute top-4 right-4 z-10 p-2 bg-slate-800/80 text-white rounded-full hover:bg-slate-700">
              <X className="w-5 h-5" />
            </button>
            <div className="p-4 flex items-center justify-center min-h-[50vh]">
              {media[selectedMediaIndex].mediaType?.toUpperCase() === 'VIDEO' ? (
                <video src={getApiUrl(media[selectedMediaIndex].fileUrl)} controls autoPlay className="max-h-[70vh] rounded-2xl" />
              ) : (
                <img src={getApiUrl(media[selectedMediaIndex].fileUrl)} alt={media[selectedMediaIndex].caption} className="max-h-[75vh] object-contain rounded-2xl" />
              )}
            </div>
            <div className="p-4 bg-slate-950 text-white flex items-center justify-between text-xs">
              <div>
                <h4 className="font-extrabold">{media[selectedMediaIndex].caption}</h4>
                <p className="text-[11px] text-slate-400">{media[selectedMediaIndex].mediaType} • {new Date(media[selectedMediaIndex].createdAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Budget Modal (Requirement 9) */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" /> Manage Financial Budget
              </h3>
              <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">✕</button>
            </div>

            <form onSubmit={handleBudgetUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Estimated Budget (₹)</label>
                  <input
                    type="number"
                    required
                    value={budgetForm.estimatedBudget}
                    onChange={(e) => setBudgetForm({ ...budgetForm, estimatedBudget: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Funding Source</label>
                  <input
                    type="text"
                    value={budgetForm.fundingSource}
                    onChange={(e) => setBudgetForm({ ...budgetForm, fundingSource: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              {['HOD', 'ADMIN', 'DIRECTOR'].includes(user?.role) && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block font-bold text-emerald-600 dark:text-emerald-400 mb-1">Approved Budget (₹)</label>
                    <input
                      type="number"
                      value={budgetForm.approvedBudget}
                      onChange={(e) => setBudgetForm({ ...budgetForm, approvedBudget: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 font-black text-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Budget Status</label>
                    <select
                      value={budgetForm.budgetStatus}
                      onChange={(e) => setBudgetForm({ ...budgetForm, budgetStatus: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                    >
                      <option value="PROPOSED">PROPOSED</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REVISED">REVISED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block font-bold text-amber-600 dark:text-amber-400 mb-1">Actual Expenditure Logged (₹)</label>
                <input
                  type="number"
                  value={budgetForm.actualExpenditure}
                  onChange={(e) => setBudgetForm({ ...budgetForm, actualExpenditure: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 font-black text-amber-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowBudgetModal(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl text-slate-700 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={submittingBudget} className="px-5 py-2 bg-emerald-600 text-white font-extrabold rounded-xl shadow-lg">
                  {submittingBudget ? 'Saving...' : 'Save Financial Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <QRCodeModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} activity={activity} />
      <PDFViewerModal isOpen={showPdfModal} onClose={() => setShowPdfModal(false)} activityId={activity._id} pdfType="activity" />

    </div>
  );
};

export default ActivityDetail;
