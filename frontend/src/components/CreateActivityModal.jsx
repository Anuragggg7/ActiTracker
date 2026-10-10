import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { Plus, X, Calendar, MapPin, Clock, AlertTriangle, FileText, CheckCircle2, ChevronRight, ChevronLeft, Save, Sparkles } from 'lucide-react';
import { fetchDepartmentsWithFallback } from '../utils/departments';

const STANDARD_TIME_SLOTS = [
  { startTime: '09:00', endTime: '10:00', label: '09:00 AM - 10:00 AM' },
  { startTime: '10:00', endTime: '11:00', label: '10:00 AM - 11:00 AM' },
  { startTime: '11:00', endTime: '12:00', label: '11:00 AM - 12:00 PM' },
  { startTime: '12:00', endTime: '13:00', label: '12:00 PM - 01:00 PM' },
  { startTime: '13:00', endTime: '14:00', label: '01:00 PM - 02:00 PM' },
  { startTime: '14:00', endTime: '15:00', label: '02:00 PM - 03:00 PM' },
  { startTime: '15:00', endTime: '16:00', label: '03:00 PM - 04:00 PM' },
  { startTime: '16:00', endTime: '17:00', label: '04:00 PM - 05:00 PM' }
];

function isOverlapping(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  const toMins = (t) => {
    const parts = t.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };
  const aStart = toMins(startA);
  const aEnd = toMins(endA);
  const bStart = toMins(startB);
  const bEnd = toMins(endB);
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

export const CreateActivityModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useNotifications();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [venues, setVenues] = useState([]);
  const [occupiedSlots, setOccupiedSlots] = useState([]);
  const [slotChecking, setSlotChecking] = useState(false);

  // Form State (Proposal details and schedule)
  const [form, setForm] = useState({
    title: '',
    category: 'Workshop',
    departmentId: '',
    description: '',
    objectives: '',
    targetAudience: 'Students & Faculty',
    speakerName: '',
    speakerOrg: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '13:00',
    venueId: '',
    venueName: '',
    expectedParticipants: '60',
    estimatedBudget: '5000',
    fundingSource: 'Departmental Budget'
  });

  useEffect(() => {
    if (!isOpen) return;
    const fetchMasters = async () => {
      try {
        const [deptsList, venueRes] = await Promise.all([
          fetchDepartmentsWithFallback(),
          api.get('/slots/venues').catch(() => ({ success: false }))
        ]);
        setDepartments(deptsList || []);
        if (venueRes && venueRes.success) setVenues(venueRes.venues || []);
      } catch (err) {
        console.error('Master fetch error:', err);
      }
    };
    fetchMasters();
  }, [isOpen]);

  const fetchVenueSchedule = async (venueId, dateStr) => {
    if (!venueId || !dateStr) {
      setOccupiedSlots([]);
      return;
    }
    try {
      setSlotChecking(true);
      const res = await api.get(`/slots/venue-schedule?venueId=${venueId}&date=${dateStr}`);
      if (res.success) {
        setOccupiedSlots(res.occupiedSlots || []);
      }
    } catch (err) {
      console.error('Venue schedule error:', err);
    } finally {
      setSlotChecking(false);
    }
  };

  useEffect(() => {
    if (form.venueId && form.date) {
      fetchVenueSchedule(form.venueId, form.date);
    }
  }, [form.venueId, form.date]);

  if (!isOpen) return null;

  const validateStep1 = () => {
    if (!form.title.trim()) {
      showToast('Please enter an activity title', 'warning');
      return false;
    }
    if (!form.description.trim()) {
      showToast('Please provide an activity concept/description', 'warning');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(step + 1);
  };

  const handleSubmit = async (isDraft = false) => {
    if (loading) return;

    if (!isDraft) {
      if (!validateStep1()) {
        setStep(1);
        return;
      }
      if (!form.date) {
        showToast('Please select a proposed activity date', 'warning');
        setStep(2);
        return;
      }
      if (!form.startTime || !form.endTime) {
        showToast('Please select both start and end times', 'warning');
        setStep(2);
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        title: form.title,
        category: form.category,
        departmentId: form.departmentId || undefined,
        description: form.description,
        objectives: form.objectives,
        targetAudience: form.targetAudience,
        guestSpeaker: { name: form.speakerName, organization: form.speakerOrg },
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        venueId: form.venueId || undefined,
        venueName: form.venueName || 'TBD',
        expectedParticipants: Number(form.expectedParticipants) || 50,
        estimatedBudget: Number(form.estimatedBudget) || 0,
        fundingSource: form.fundingSource,
        isDraft
      };

      const res = await api.post('/activities', payload);
      if (res.success && res.activity) {
        showToast(
          isDraft
            ? 'Activity proposal saved as draft!'
            : 'Activity request submitted to HOD for review!',
          'success'
        );
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to submit activity request';
      if (err.status === 409 || err.response?.status === 409 || errMsg.includes('booked already')) {
        showToast('This time slot has been booked already!', 'error');
        if (form.venueId && form.date) {
          fetchVenueSchedule(form.venueId, form.date);
        }
        setStep(2);
      } else {
        showToast(errMsg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-rcpit-600" /> Propose Institutional Activity Request
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Submit proposal for HOD review & Admin final institutional approval
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Step Progress Indicator */}
        <div className="grid grid-cols-2 gap-3 text-xs font-bold text-center">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`p-3 rounded-2xl border transition-all flex items-center justify-center gap-2 ${
              step === 1
                ? 'bg-rcpit-50 border-rcpit-500 text-rcpit-600 dark:bg-rcpit-950/40 dark:border-rcpit-500 shadow-sm ring-1 ring-rcpit-400'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              step === 1 ? 'bg-rcpit-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              1
            </span>
            <span>1. Activity Details</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
            className={`p-3 rounded-2xl border transition-all flex items-center justify-center gap-2 ${
              step === 2
                ? 'bg-rcpit-50 border-rcpit-500 text-rcpit-600 dark:bg-rcpit-950/40 dark:border-rcpit-500 shadow-sm ring-1 ring-rcpit-400'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              step === 2 ? 'bg-rcpit-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              2
            </span>
            <span>2. Proposed Schedule</span>
          </button>
        </div>

        {/* STEP 1: Activity Details */}
        {step === 1 && (
          <div className="space-y-4 text-xs animate-fade-in">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Activity Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Workshop on Next-Gen Generative AI Frameworks"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-rcpit-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Activity Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                >
                  {['Workshop', 'Seminar', 'FDP', 'Guest Lecture', 'Hackathon', 'Competition', 'Industrial Visit', 'Training', 'Placement Drive', 'Conference', 'Project Exhibition', 'Alumni Meet', 'Sports Event', 'Cultural Event', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Organizing Department</label>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium outline-none"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Default User Department</option>
                  {departments.map(d => (
                    <option key={d._id || d.code} value={d._id || d.code} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Concept & Objectives Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed summary of activity concept, objectives, and targeted learning outcomes..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-rcpit-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Audience</label>
                <input
                  type="text"
                  value={form.targetAudience}
                  onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                  placeholder="e.g. TE & BE Students, Research Scholars"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Keynote / Resource Speaker</label>
                <input
                  type="text"
                  value={form.speakerName}
                  onChange={(e) => setForm({ ...form, speakerName: e.target.value })}
                  placeholder="e.g. Dr. A. Sharma (Industry Expert)"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expected Participants</label>
                <input
                  type="number"
                  min="1"
                  value={form.expectedParticipants}
                  onChange={(e) => setForm({ ...form, expectedParticipants: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Estimated Budget (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={form.estimatedBudget}
                  onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Proposed Schedule */}
        {step === 2 && (
          <div className="space-y-4 text-xs animate-fade-in">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Proposed Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Start Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  End Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Proposed Venue</label>
              <select
                value={form.venueId}
                onChange={(e) => {
                  const sel = venues.find(v => v._id === e.target.value);
                  setForm({ ...form, venueId: e.target.value, venueName: sel ? sel.name : '' });
                }}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold outline-none"
              >
                <option value="">Select Institutional Venue (Optional / TBD)</option>
                {venues.map(v => (
                  <option key={v._id} value={v._id}>{v.name} (Cap: {v.capacity} • {v.location})</option>
                ))}
              </select>
            </div>

            {/* Visual Real-Time Slot Availability Matrix */}
            {form.venueId && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-rcpit-600" /> Real-Time Venue Availability Matrix ({form.date})
                  </span>
                  {slotChecking && <span className="text-[10px] text-amber-500 animate-pulse">Checking conflicts...</span>}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STANDARD_TIME_SLOTS.map((slot) => {
                    const isBooked = occupiedSlots.some(occ => isOverlapping(slot.startTime, slot.endTime, occ.startTime, occ.endTime));
                    const isSelected = form.startTime === slot.startTime && form.endTime === slot.endTime;

                    return (
                      <button
                        key={slot.label}
                        type="button"
                        disabled={isBooked}
                        onClick={() => setForm({ ...form, startTime: slot.startTime, endTime: slot.endTime })}
                        className={`p-2.5 rounded-xl border text-[11px] font-bold text-center transition-all flex flex-col items-center justify-between gap-1 ${
                          isBooked ? 'bg-slate-200 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-400 cursor-not-allowed opacity-60' :
                          isSelected ? 'bg-rcpit-600 text-white border-rcpit-700 shadow-md ring-2 ring-rcpit-400' :
                          'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                        }`}
                      >
                        <span className="text-[10px] tracking-tight">{slot.label}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase font-black tracking-wider ${
                          isBooked ? 'bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-400' :
                          isSelected ? 'bg-white/30 text-white' : 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200'
                        }`}>
                          {isBooked ? 'BOOKED' : isSelected ? 'SELECTED' : 'AVAILABLE'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-800 dark:text-sky-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Next Steps in Institutional Approval Workflow:</p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  Upon submission, your proposal will appear in your HOD's review queue. Once endorsed by the HOD, it will be forwarded to the System Administrator for final institutional approval. Post-event media & documentation are uploaded once the event is conducted.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> Save Draft
          </button>
          
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            
            {step === 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <span>Submitting Proposal...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Submit Activity Request
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CreateActivityModal;
