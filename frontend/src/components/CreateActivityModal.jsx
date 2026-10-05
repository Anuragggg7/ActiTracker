import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { Plus, X, Upload, Calendar, MapPin, Film, Image as ImageIcon, Video, Clock, DollarSign, Users, Award, FileText, CheckCircle2 } from 'lucide-react';
import { fetchDepartmentsWithFallback } from '../utils/departments';

export const CreateActivityModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useNotifications();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [venues, setVenues] = useState([]);

  // Form State
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

  // Media files state (Photos & Videos)
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [photoCaption, setPhotoCaption] = useState('');

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

  if (!isOpen) return null;

  const handleSubmit = async (isDraft = false) => {
    if (loading) return;
    if (!form.title || !form.description) {
      showToast('Please provide an activity title and description', 'warning');
      return;
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
        expectedParticipants: Number(form.expectedParticipants),
        estimatedBudget: Number(form.estimatedBudget),
        fundingSource: form.fundingSource,
        isDraft
      };

      const res = await api.post('/activities', payload);
      if (res.success && res.activity) {
        const activityId = res.activity._id;

        // Upload media (Photos and Videos) if attached
        const mediaFiles = [...selectedPhotos];
        if (selectedVideo) mediaFiles.push(selectedVideo);

        if (mediaFiles.length > 0) {
          const mediaData = new FormData();
          mediaFiles.forEach(file => {
            mediaData.append('files', file);
          });
          mediaData.append('caption', photoCaption || form.title);

          try {
            await api.post('/media/upload', mediaData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } catch (mediaErr) {
            console.error('Media upload error:', mediaErr);
          }
        }

        showToast(res.message || 'Activity created successfully!', 'success');
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create activity', 'error');
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
              <Plus className="w-5 h-5 text-rcpit-600" /> Create & Record Institutional Activity
            </h3>
            <p className="text-[11px] text-slate-400">
              Step {step} of 3: {step === 1 ? 'Event Details' : step === 2 ? 'Schedule & Venue' : 'Media (Photos & Videos)'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-center">
          <div className={`p-2 rounded-xl border ${step === 1 ? 'bg-rcpit-50 border-rcpit-500 text-rcpit-600 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400'}`}>
            1. Details
          </div>
          <div className={`p-2 rounded-xl border ${step === 2 ? 'bg-rcpit-50 border-rcpit-500 text-rcpit-600 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400'}`}>
            2. Schedule
          </div>
          <div className={`p-2 rounded-xl border ${step === 3 ? 'bg-rcpit-50 border-rcpit-500 text-rcpit-600 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400'}`}>
            3. Photos & Video
          </div>
        </div>

        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Activity Title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Workshop on Next-Gen Generative AI Frameworks"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {['Workshop', 'Seminar', 'FDP', 'Guest Lecture', 'Hackathon', 'Competition', 'Industrial Visit', 'Training', 'Placement Drive', 'Conference'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Select Academic Department</option>
                  {departments.map(d => (
                    <option key={d._id || d.code} value={d._id || d.code} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Concept & Description *</label>
              <textarea
                rows={3}
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed summary of activity concept, scope, and target outcomes..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Schedule & Venue */}
        {step === 2 && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Event Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Venue</label>
              <select
                value={form.venueId}
                onChange={(e) => {
                  const sel = venues.find(v => v._id === e.target.value);
                  setForm({ ...form, venueId: e.target.value, venueName: sel ? sel.name : '' });
                }}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Choose Institutional Venue</option>
                {venues.map(v => (
                  <option key={v._id} value={v._id}>{v.name} (Cap: {v.capacity} • {v.location})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expected Participants</label>
                <input
                  type="number"
                  value={form.expectedParticipants}
                  onChange={(e) => setForm({ ...form, expectedParticipants: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Estimated Budget (₹)</label>
                <input
                  type="number"
                  value={form.estimatedBudget}
                  onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Photos (JPG/PNG) & Video (MP4/WebM) Attachment */}
        {step === 3 && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl border border-rcpit-200 dark:border-slate-700 bg-rcpit-50/50 dark:bg-slate-800/40 space-y-3">
              <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-rcpit-600" /> Event Photos (JPG, PNG)
              </h4>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setSelectedPhotos(Array.from(e.target.files))}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
              {selectedPhotos.length > 0 && (
                <p className="text-[11px] font-bold text-emerald-600">
                  ✓ {selectedPhotos.length} photo(s) selected
                </p>
              )}
            </div>

            <div className="p-4 rounded-2xl border border-sky-200 dark:border-slate-700 bg-sky-50/50 dark:bg-slate-800/40 space-y-3">
              <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-sky-600" /> Event Video Recording (MP4, WebM, MOV)
              </h4>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => setSelectedVideo(e.target.files[0] || null)}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
              {selectedVideo && (
                <p className="text-[11px] font-bold text-sky-600">
                  ✓ Video file selected: {selectedVideo.name} ({(selectedVideo.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Media Caption</label>
              <input
                type="text"
                placeholder="e.g. Keynote Inauguration & Hands-on Lab Session"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold text-xs rounded-xl"
          >
            Save Draft
          </button>
          
          <div className="space-x-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl"
              >
                Back
              </button>
            )}
            
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-5 py-2 bg-rcpit-600 text-white font-bold text-xs rounded-xl"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow"
              >
                {loading ? 'Submitting Activity...' : 'Submit & Upload Activity'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CreateActivityModal;
