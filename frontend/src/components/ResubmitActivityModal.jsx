import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { RotateCcw, AlertTriangle, X, CheckCircle2, Clock, Calendar, MapPin, Loader2 } from 'lucide-react';

export const ResubmitActivityModal = ({ isOpen, onClose, activity, onSuccess }) => {
  const { showToast } = useNotifications();

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    venueId: '',
    expectedParticipants: 50,
    estimatedBudget: 0,
    fundingSource: '',
    resubmitNotes: ''
  });

  const [venues, setVenues] = useState([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Latest change request
  const latestChangeRequest = activity?.changeRequests?.slice()?.reverse()?.find(cr => cr.status === 'PENDING') 
    || activity?.changeRequests?.[activity.changeRequests.length - 1];

  useEffect(() => {
    if (activity) {
      setFormData({
        title: activity.title || '',
        category: activity.category || 'Workshop',
        description: activity.description || '',
        date: activity.date ? new Date(activity.date).toISOString().split('T')[0] : '',
        startTime: activity.startTime || '10:00',
        endTime: activity.endTime || '13:00',
        venueId: activity.venueId?._id || activity.venueId || '',
        expectedParticipants: activity.expectedParticipants || 50,
        estimatedBudget: activity.estimatedBudget || 0,
        fundingSource: activity.fundingSource || 'Departmental Budget',
        resubmitNotes: ''
      });
    }

    const fetchVenues = async () => {
      try {
        setLoadingVenues(true);
        const res = await api.get('/venues');
        if (res.success) {
          setVenues(res.venues || []);
        }
      } catch (err) {
        console.error('Failed to load venues', err);
      } finally {
        setLoadingVenues(false);
      }
    };

    if (isOpen) {
      fetchVenues();
    }
  }, [activity, isOpen]);

  if (!isOpen || !activity) return null;

  // Live word counter
  const wordCount = formData.description ? formData.description.trim().split(/\s+/).filter(Boolean).length : 0;
  const isWordCountValid = wordCount <= 300;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isWordCountValid) {
      showToast('Description exceeds 300 words. Please shorten before submitting.', 'warning');
      return;
    }

    if (!formData.resubmitNotes.trim()) {
      showToast('Please provide a note explaining the modifications made.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/activities/${activity._id}/resubmit`, formData);
      if (res.success) {
        showToast(res.message || 'Activity resubmitted successfully for review', 'success');
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Resubmission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-xs my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Update & Resubmit Activity
              </h3>
              <p className="text-[11px] text-slate-400">
                Address reviewer feedback and resubmit for institutional approval
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Change Request Instruction Callout (Change 3) */}
        <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-extrabold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Requested Modifications by {latestChangeRequest?.requestedByRole || 'Reviewer'}</span>
            </div>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
              {latestChangeRequest?.requestedAt ? new Date(latestChangeRequest.requestedAt).toLocaleString() : 'Recent'}
            </span>
          </div>

          <p className="text-xs text-amber-950 dark:text-amber-200 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/60 font-medium whitespace-pre-line leading-relaxed">
            "{latestChangeRequest?.instructions || activity.adminReviewNotes || activity.hodReviewNotes || 'Please review and adjust activity details.'}"
          </p>

          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            • After updating the required fields below, describe the changes made in the explanation note and click Submit.
          </p>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Activity Title <span className="text-rcpit-600">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Activity Objectives & Description <span className="text-rcpit-600">*</span>
              </label>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                isWordCountValid ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-rose-100 text-rose-700 font-black'
              }`}>
                {wordCount} / 300 words
              </span>
            </div>
            <textarea
              rows="4"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-normal"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">End Time</label>
              <input
                type="time"
                required
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Institutional Venue</label>
              <select
                value={formData.venueId}
                onChange={(e) => setFormData({ ...formData, venueId: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              >
                <option value="">Select Venue...</option>
                {venues.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name} (Cap: {v.capacity})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expected Participants</label>
              <input
                type="number"
                value={formData.expectedParticipants}
                onChange={(e) => setFormData({ ...formData, expectedParticipants: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
          </div>

          {/* Resubmission Explanation Note (Mandatory) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
              Explanation of Modifications Made <span className="text-rcpit-600">*</span>
            </label>
            <textarea
              rows="3"
              required
              placeholder="Explain how you addressed the reviewer's instructions (e.g., 'Updated participant count to 45 and revised description objectives')..."
              value={formData.resubmitNotes}
              onChange={(e) => setFormData({ ...formData, resubmitNotes: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rcpit-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isWordCountValid || !formData.resubmitNotes.trim()}
              className="px-5 py-2.5 bg-rcpit-600 hover:bg-rcpit-500 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Resubmitting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" /> Resubmit Activity for Review
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default ResubmitActivityModal;
