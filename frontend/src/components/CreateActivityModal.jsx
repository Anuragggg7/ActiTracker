import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import {
  Plus, X, Calendar, MapPin, Clock, AlertTriangle, FileText, CheckCircle2,
  ChevronRight, ChevronLeft, Save, Sparkles, Users, Layers, AlertCircle, Info, RefreshCw
} from 'lucide-react';
import { fetchDepartmentsWithFallback } from '../utils/departments';

// Institutional Operating Window: 06:00 AM to 10:00 PM
export const INSTITUTIONAL_START = '06:00';
export const INSTITUTIONAL_END = '22:00';

const STANDARD_TIME_SLOTS = [
  { startTime: '09:00', endTime: '10:00', label: '09:00 AM - 10:00 AM' },
  { startTime: '10:00', endTime: '11:00', label: '10:00 AM - 11:00 AM' },
  { startTime: '11:00', endTime: '12:00', label: '11:00 AM - 12:00 PM' },
  { startTime: '12:00', endTime: '13:00', label: '12:00 PM - 01:00 PM' },
  { startTime: '13:00', endTime: '14:00', label: '01:00 PM - 02:00 PM' },
  { startTime: '14:00', endTime: '15:00', label: '02:00 PM - 03:00 PM' },
  { startTime: '15:00', endTime: '16:00', label: '03:00 PM - 04:00 PM' },
  { startTime: '16:00', endTime: '17:00', label: '04:00 PM - 05:00 PM' },
  { startTime: '17:00', endTime: '18:00', label: '05:00 PM - 06:00 PM' }
];

export const countWords = (text) => {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

export const toMins = (t) => {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};

export function isOverlapping(startA, endA, startB, endB, isAllDayA = false, isAllDayB = false) {
  if (isAllDayA || isAllDayB) return true;
  if (!startA || !endA || !startB || !endB) return false;
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

  // Scheduling Mode: 'SINGLE' or 'MULTI'
  const [scheduleMode, setScheduleMode] = useState('SINGLE');

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
    expectedParticipants: '60',
    estimatedBudget: '5000',
    fundingSource: 'Departmental Budget',
    // Single-day schedule
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '13:00',
    isAllDay: false,
    venueId: '',
    venueName: '',
    // Multi-session schedule
    sessions: [
      {
        sessionTitle: 'Session 1',
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '13:00',
        isAllDay: false,
        venueId: '',
        venueName: '',
        expectedParticipants: '60'
      }
    ]
  });

  // Conflict & Waiting Queue state
  const [conflictDetected, setConflictDetected] = useState(null);
  const [joiningQueue, setJoiningQueue] = useState(false);

  // Word count calculation
  const wordCount = countWords(form.description);
  const isWordLimitExceeded = wordCount > 300;

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

  // Selected venue capacity check
  const selectedVenue = venues.find(v => v._id === form.venueId);
  const expectedCount = Number(form.expectedParticipants) || 0;
  const isCapacityExceeded = selectedVenue && expectedCount > selectedVenue.capacity;

  const suitableVenues = venues.filter(v => v.capacity >= expectedCount && v._id !== form.venueId);

  // Duration in hours calculation
  const calcDuration = (start, end, allDay) => {
    if (allDay) return 16;
    const sm = toMins(start);
    const em = toMins(end);
    if (em <= sm) return 0;
    return Math.round(((em - sm) / 60) * 10) / 10;
  };

  const validateStep1 = () => {
    if (!form.title.trim()) {
      showToast('Please enter an activity title', 'warning');
      return false;
    }
    if (!form.description.trim()) {
      showToast('Please provide an activity description', 'warning');
      return false;
    }
    if (isWordLimitExceeded) {
      showToast(`Activity description exceeds 300 words (${wordCount}/300). Please shorten it.`, 'warning');
      return false;
    }
    if (!form.expectedParticipants || Number(form.expectedParticipants) <= 0) {
      showToast('Please enter expected number of participants', 'warning');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (scheduleMode === 'SINGLE') {
      if (!form.date) {
        showToast('Please select a proposed activity date', 'warning');
        return false;
      }
      if (!form.isAllDay) {
        if (!form.startTime || !form.endTime) {
          showToast('Please select start and end times', 'warning');
          return false;
        }
        if (toMins(form.startTime) >= toMins(form.endTime)) {
          showToast('Start time must be strictly earlier than end time', 'warning');
          return false;
        }
        if (toMins(form.startTime) < toMins(INSTITUTIONAL_START) || toMins(form.endTime) > toMins(INSTITUTIONAL_END)) {
          showToast('Scheduling must be within institutional hours: 06:00 AM to 10:00 PM', 'warning');
          return false;
        }
      }
      if (isCapacityExceeded) {
        showToast(`Selected venue "${selectedVenue.name}" capacity (${selectedVenue.capacity}) is smaller than expected participants (${expectedCount})`, 'error');
        return false;
      }
    } else {
      if (!form.sessions || form.sessions.length === 0) {
        showToast('Please add at least one session', 'warning');
        return false;
      }
      for (let i = 0; i < form.sessions.length; i++) {
        const s = form.sessions[i];
        if (!s.date) {
          showToast(`Session ${i + 1}: Please select a date`, 'warning');
          return false;
        }
        if (!s.isAllDay) {
          if (!s.startTime || !s.endTime) {
            showToast(`Session ${i + 1}: Please specify start and end time`, 'warning');
            return false;
          }
          if (toMins(s.startTime) >= toMins(s.endTime)) {
            showToast(`Session ${i + 1}: Start time must be earlier than end time`, 'warning');
            return false;
          }
        }
        if (s.venueId) {
          const v = venues.find(ven => ven._id === s.venueId);
          const sExp = Number(s.expectedParticipants) || expectedCount;
          if (v && sExp > v.capacity) {
            showToast(`Session ${i + 1}: Expected participants (${sExp}) exceeds capacity (${v.capacity}) for "${v.name}"`, 'error');
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(step + 1);
  };

  // Add a session in Multi-Session mode
  const handleAddSession = () => {
    const nextIdx = form.sessions.length + 1;
    const lastSession = form.sessions[form.sessions.length - 1] || {};
    const nextDateObj = new Date(lastSession.date || form.date);
    nextDateObj.setDate(nextDateObj.getDate() + 1);

    setForm({
      ...form,
      sessions: [
        ...form.sessions,
        {
          sessionTitle: `Session ${nextIdx}`,
          date: nextDateObj.toISOString().split('T')[0],
          startTime: lastSession.startTime || '10:00',
          endTime: lastSession.endTime || '13:00',
          isAllDay: false,
          venueId: lastSession.venueId || form.venueId || '',
          venueName: lastSession.venueName || form.venueName || '',
          expectedParticipants: lastSession.expectedParticipants || form.expectedParticipants || '60'
        }
      ]
    });
  };

  const handleRemoveSession = (idx) => {
    if (form.sessions.length <= 1) return;
    setForm({
      ...form,
      sessions: form.sessions.filter((_, i) => i !== idx)
    });
  };

  const handleUpdateSession = (idx, field, value) => {
    const updated = [...form.sessions];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'venueId') {
      const v = venues.find(ven => ven._id === value);
      updated[idx].venueName = v ? v.name : '';
    }
    setForm({ ...form, sessions: updated });
  };

  const handleSubmit = async (isDraft = false) => {
    if (loading) return;

    if (!isDraft) {
      if (!validateStep1()) {
        setStep(1);
        return;
      }
      if (!validateStep2()) {
        setStep(2);
        return;
      }
    }

    try {
      setLoading(true);
      setConflictDetected(null);

      let payload = {
        title: form.title,
        category: form.category,
        departmentId: form.departmentId || undefined,
        description: form.description,
        objectives: form.objectives,
        targetAudience: form.targetAudience,
        guestSpeaker: { name: form.speakerName, organization: form.speakerOrg },
        expectedParticipants: Number(form.expectedParticipants) || 50,
        estimatedBudget: Number(form.estimatedBudget) || 0,
        fundingSource: form.fundingSource,
        isDraft
      };

      if (scheduleMode === 'SINGLE') {
        payload.date = form.date;
        payload.startTime = form.isAllDay ? '06:00' : form.startTime;
        payload.endTime = form.isAllDay ? '22:00' : form.endTime;
        payload.durationHours = calcDuration(form.startTime, form.endTime, form.isAllDay);
        payload.isAllDay = form.isAllDay;
        payload.venueId = form.venueId || undefined;
        payload.venueName = form.venueName || 'TBD';
      } else {
        // Multi-Session mode
        const formattedSessions = form.sessions.map((s, idx) => ({
          sessionTitle: s.sessionTitle || `Session ${idx + 1}`,
          date: s.date,
          startTime: s.isAllDay ? '06:00' : s.startTime,
          endTime: s.isAllDay ? '22:00' : s.endTime,
          durationHours: calcDuration(s.startTime, s.endTime, s.isAllDay),
          isAllDay: !!s.isAllDay,
          venueId: s.venueId || form.venueId || undefined,
          venueName: s.venueName || form.venueName || 'TBD',
          expectedParticipants: Number(s.expectedParticipants) || Number(form.expectedParticipants) || 50
        }));

        payload.sessions = formattedSessions;
        const first = formattedSessions[0];
        payload.date = first.date;
        payload.startTime = first.startTime;
        payload.endTime = first.endTime;
        payload.durationHours = first.durationHours;
        payload.isAllDay = first.isAllDay;
        payload.venueId = first.venueId;
        payload.venueName = first.venueName;
      }

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
        setConflictDetected({
          message: errMsg,
          venueId: form.venueId,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          isAllDay: form.isAllDay
        });
        showToast('This venue slot is booked already. You can join the waiting queue below.', 'error');
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

  // Join FCFS Waiting Queue if slot is conflicting
  const handleJoinWaitingQueue = async () => {
    if (!conflictDetected || !conflictDetected.venueId) return;
    try {
      setJoiningQueue(true);
      // First save draft if not saved
      const draftRes = await api.post('/activities', {
        title: form.title,
        category: form.category,
        departmentId: form.departmentId || undefined,
        description: form.description,
        date: conflictDetected.date,
        startTime: conflictDetected.startTime,
        endTime: conflictDetected.endTime,
        isAllDay: conflictDetected.isAllDay,
        venueId: conflictDetected.venueId,
        expectedParticipants: Number(form.expectedParticipants) || 50,
        isDraft: true
      });

      if (draftRes.success && draftRes.activity) {
        const queueRes = await api.post('/slots/waiting-queue', {
          activityId: draftRes.activity._id,
          venueId: conflictDetected.venueId,
          date: conflictDetected.date,
          startTime: conflictDetected.startTime,
          endTime: conflictDetected.endTime,
          isAllDay: conflictDetected.isAllDay,
          notes: 'Joined waiting queue due to conflict at booking time'
        });

        if (queueRes.success) {
          showToast('Added to FCFS waiting queue! You will receive a slot offer if this slot is cancelled.', 'success');
          onClose();
          if (onSuccess) onSuccess();
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to join waiting queue', 'error');
    } finally {
      setJoiningQueue(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        
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
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-rcpit-500 outline-none font-semibold"
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

            {/* Enhancement G: Activity Description Limit of 300 Words with Live Counter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Concept & Objectives Description <span className="text-rose-500">*</span>
                </label>
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                  isWordLimitExceeded
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 border border-rose-300 dark:border-rose-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {wordCount} / 300 words
                </span>
              </div>
              <textarea
                rows={4}
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed summary of activity concept, objectives, and targeted learning outcomes (maximum 300 words)..."
                className={`w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-none transition-all ${
                  isWordLimitExceeded
                    ? 'border-rose-500 focus:ring-2 focus:ring-rose-400'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rcpit-500'
                }`}
              />
              {isWordLimitExceeded && (
                <p className="text-[11px] text-rose-500 font-bold mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Description exceeds 300 words limit. Please shorten by {wordCount - 300} words before proceeding.
                </p>
              )}
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
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Expected Number of Participants / Students <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.expectedParticipants}
                  onChange={(e) => setForm({ ...form, expectedParticipants: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Used for real-time institutional venue capacity validation.
                </p>
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
            
            {/* Scheduling Type Toggles */}
            <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setScheduleMode('SINGLE')}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  scheduleMode === 'SINGLE'
                    ? 'bg-white dark:bg-slate-900 text-rcpit-600 dark:text-rcpit-400 shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Single Day / Session
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode('MULTI')}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  scheduleMode === 'MULTI'
                    ? 'bg-white dark:bg-slate-900 text-rcpit-600 dark:text-rcpit-400 shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Multiple Sessions / Days (Enhancement B)
              </button>
            </div>

            {/* SINGLE SESSION MODE */}
            {scheduleMode === 'SINGLE' && (
              <div className="space-y-4">
                {/* All-Day Scheduling Toggle (Enhancement A.B) */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rcpit-600" />
                    <div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">All-Day Activity Scheduling</span>
                      <p className="text-[10px] text-slate-400">Reserves venue for entire institutional day (06:00 AM - 10:00 PM)</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isAllDay}
                      onChange={(e) => setForm({ ...form, isAllDay: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rcpit-600"></div>
                  </label>
                </div>

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
                      Start Time (06:00 - 22:00) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      disabled={form.isAllDay}
                      min="06:00"
                      max="22:00"
                      value={form.isAllDay ? '06:00' : form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      End Time (06:00 - 22:00) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      disabled={form.isAllDay}
                      min="06:00"
                      max="22:00"
                      value={form.isAllDay ? '22:00' : form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Duration indicator */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                  <span>Calculated Duration:</span>
                  <span className="font-bold text-rcpit-600 dark:text-rcpit-400">
                    {form.isAllDay ? 'Full Day (16.0 Hours)' : `${calcDuration(form.startTime, form.endTime, false)} Hours`}
                  </span>
                </div>

                {/* Venue selection & Capacity validation (Enhancement D) */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Proposed Venue</label>
                  <select
                    value={form.venueId}
                    onChange={(e) => {
                      const sel = venues.find(v => v._id === e.target.value);
                      setForm({ ...form, venueId: e.target.value, venueName: sel ? sel.name : '' });
                    }}
                    className={`w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white font-semibold outline-none ${
                      isCapacityExceeded ? 'border-rose-500 ring-1 ring-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <option value="">Select Institutional Venue (Optional / TBD)</option>
                    {venues.map(v => (
                      <option key={v._id} value={v._id}>
                        {v.name} (Capacity: {v.capacity} • {v.location}) {v.capacity < expectedCount ? '— [CAPACITY EXCEEDED]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Capacity Exceeded Alert */}
                {isCapacityExceeded && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Venue Capacity Exceeded!</p>
                        <p className="text-[11px] mt-0.5">
                          Selected venue "{selectedVenue.name}" has a maximum configured capacity of <strong>{selectedVenue.capacity}</strong> attendees, but your expected attendance is <strong>{expectedCount}</strong>.
                        </p>
                      </div>
                    </div>
                    {suitableVenues.length > 0 && (
                      <div className="pt-2 border-t border-rose-200 dark:border-rose-800">
                        <span className="font-bold text-[11px]">Recommended Available Larger Venues:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {suitableVenues.map(sv => (
                            <button
                              key={sv._id}
                              type="button"
                              onClick={() => setForm({ ...form, venueId: sv._id, venueName: sv.name })}
                              className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-lg text-[10px] font-bold text-slate-800 dark:text-slate-200 hover:bg-rose-100"
                            >
                              👉 Switch to {sv.name} (Cap: {sv.capacity})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Real-Time Availability Matrix */}
                {form.venueId && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-rcpit-600" /> Real-Time Venue Availability Matrix ({form.date})
                      </span>
                      {slotChecking && <span className="text-[10px] text-amber-500 animate-pulse">Checking conflicts...</span>}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {STANDARD_TIME_SLOTS.map((slot) => {
                        const isBooked = occupiedSlots.some(occ => isOverlapping(slot.startTime, slot.endTime, occ.startTime, occ.endTime, false, occ.isAllDay));
                        const isSelected = !form.isAllDay && form.startTime === slot.startTime && form.endTime === slot.endTime;

                        return (
                          <button
                            key={slot.label}
                            type="button"
                            disabled={isBooked}
                            onClick={() => setForm({ ...form, startTime: slot.startTime, endTime: slot.endTime, isAllDay: false })}
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
              </div>
            )}

            {/* MULTIPLE SESSIONS MODE (Enhancement B) */}
            {scheduleMode === 'MULTI' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-rcpit-600" /> Multi-Session Occurrences ({form.sessions.length} sessions)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSession}
                    className="px-3 py-1.5 bg-rcpit-50 hover:bg-rcpit-100 dark:bg-rcpit-950/60 dark:hover:bg-rcpit-900/60 text-rcpit-600 dark:text-rcpit-300 rounded-xl font-bold text-xs flex items-center gap-1 border border-rcpit-200 dark:border-rcpit-800"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Occurrence
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {form.sessions.map((sess, idx) => {
                    const sessVenue = venues.find(v => v._id === sess.venueId);
                    const sExp = Number(sess.expectedParticipants) || expectedCount;
                    const sCapExceeded = sessVenue && sExp > sessVenue.capacity;

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-rcpit-600 dark:text-rcpit-400">
                            {sess.sessionTitle || `Session ${idx + 1}`}
                          </span>
                          {form.sessions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSession(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg text-[11px] font-bold"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Session Title</label>
                            <input
                              type="text"
                              value={sess.sessionTitle}
                              onChange={(e) => handleUpdateSession(idx, 'sessionTitle', e.target.value)}
                              placeholder={`Session ${idx + 1}`}
                              className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Date</label>
                            <input
                              type="date"
                              required
                              value={sess.date}
                              onChange={(e) => handleUpdateSession(idx, 'date', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Start Time</label>
                            <input
                              type="time"
                              required
                              value={sess.startTime}
                              onChange={(e) => handleUpdateSession(idx, 'startTime', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">End Time</label>
                            <input
                              type="time"
                              required
                              value={sess.endTime}
                              onChange={(e) => handleUpdateSession(idx, 'endTime', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Session Venue</label>
                            <select
                              value={sess.venueId}
                              onChange={(e) => handleUpdateSession(idx, 'venueId', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-xs"
                            >
                              <option value="">Select Venue</option>
                              {venues.map(v => (
                                <option key={v._id} value={v._id}>
                                  {v.name} (Cap: {v.capacity})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Expected Participants</label>
                            <input
                              type="number"
                              min="1"
                              value={sess.expectedParticipants}
                              onChange={(e) => handleUpdateSession(idx, 'expectedParticipants', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-xs"
                            />
                          </div>
                        </div>

                        {sCapExceeded && (
                          <p className="text-[10px] text-rose-500 font-bold">
                            ⚠️ Expected participants ({sExp}) exceeds venue capacity ({sessVenue.capacity}) for "{sessVenue.name}".
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conflict & Waiting Queue Callout (Enhancement C) */}
            {conflictDetected && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-xs text-amber-900 dark:text-amber-200">
                      Slot Conflict Detected — Instant FCFS Queue Available
                    </h4>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      The slot at {form.venueName || 'this venue'} on {conflictDetected.date} ({conflictDetected.startTime} - {conflictDetected.endTime}) is already confirmed by another department.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">
                    If this slot is cancelled, it will be automatically offered to you based on your FCFS queue timestamp.
                  </span>
                  <button
                    type="button"
                    onClick={handleJoinWaitingQueue}
                    disabled={joiningQueue}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    {joiningQueue ? 'Enqueueing...' : 'Join FCFS Waiting Queue'}
                  </button>
                </div>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-800 dark:text-sky-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Institutional Approval Pipeline:</p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  Proposal will be submitted to your HOD. HOD can endorse and recommend priority to Admin for final institutional approval. Post-event media & documentation are uploaded once the event is conducted.
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
                disabled={isWordLimitExceeded}
                className="px-5 py-2.5 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1 disabled:opacity-50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={loading || (scheduleMode === 'SINGLE' && isCapacityExceeded)}
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
