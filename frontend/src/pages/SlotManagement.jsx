import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Clock, MapPin, CheckCircle2, XCircle, Plus, AlertTriangle, Calendar, Trash2 } from 'lucide-react';

export const SlotManagement = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [venues, setVenues] = useState([]);
  const [slotRequests, setSlotRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddVenue, setShowAddVenue] = useState(false);

  const [newVenue, setNewVenue] = useState({ name: '', code: '', capacity: 100, location: '', facilities: '' });

  const fetchSlotData = async () => {
    try {
      setLoading(true);
      const [venueRes, reqRes] = await Promise.all([
        api.get('/slots/venues'),
        api.get('/slots/requests')
      ]);

      if (venueRes.success) setVenues(venueRes.venues || []);
      if (reqRes.success) setSlotRequests(reqRes.requests || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch venue & slot data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlotData();
  }, []);

  const handleRemoveVenue = async (venueId, venueName) => {
    if (!window.confirm(`Are you sure you want to remove venue "${venueName}"?`)) return;
    try {
      const res = await api.delete(`/slots/venues/${venueId}`);
      if (res.success) {
        showToast(res.message || 'Venue removed successfully', 'success');
        fetchSlotData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to remove venue', 'error');
    }
  };

  const handleReviewSlot = async (requestId, action, adminNotes = '') => {
    try {
      const res = await api.put(`/slots/review/${requestId}`, { action, adminNotes });
      if (res.success) {
        showToast(`Slot request ${action.toLowerCase()} successfully`, 'success');
        fetchSlotData();
      }
    } catch (err) {
      showToast(err.message || 'Slot review failed', 'error');
    }
  };

  const handleCreateVenue = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newVenue,
        facilities: newVenue.facilities.split(',').map(f => f.trim())
      };
      const res = await api.post('/slots/venues', payload);
      if (res.success) {
        showToast(res.message || 'Venue added successfully', 'success');
        setShowAddVenue(false);
        setNewVenue({ name: '', code: '', capacity: 100, location: '', facilities: '' });
        fetchSlotData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to add venue', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-rcpit-900 via-rcpit-800 to-rcpit-950 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rcpit-400 bg-rcpit-950/80 px-3 py-1 rounded-full border border-rcpit-800">
            Centralized Scheduling
          </span>
          <h1 className="text-2xl font-extrabold mt-2 flex items-center gap-2">
            <Clock className="w-6 h-6 text-rcpit-400" /> Slot & Venue Management
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Institutional venue master setup, conflict resolution & slot allocation governance
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowAddVenue(true)}
            className="px-5 py-3 bg-rcpit-500 hover:bg-rcpit-400 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 self-start md:self-auto transition-all"
          >
            <Plus className="w-4 h-4" /> Register New Venue
          </button>
        )}
      </div>

      {/* Venues Grid */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
          Institutional Venues Master List ({venues.length})
        </h3>
        
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading venue records...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {venues.map((v) => (
              <div key={v._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs relative group">
                <div className="flex items-center justify-between">
                  <span className="font-black text-rcpit-600 dark:text-rcpit-400 uppercase text-[10px]">{v.code}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500">Cap: {v.capacity} seats</span>
                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => handleRemoveVenue(v._id, v.name)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/80 rounded-lg transition-colors"
                        title={`Remove ${v.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white">{v.name}</h4>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rcpit-600" /> {v.location}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slot Requests Table */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
          Venue Slot Allocation Requests ({slotRequests.length})
        </h3>

        {slotRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No active slot allocation requests.</div>
        ) : (
          <div className="space-y-3">
            {slotRequests.map((req) => (
              <div key={req._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white">
                    {req.activityId?.title || 'Institutional Activity'}
                  </h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Requested Venue: <strong className="text-slate-800 dark:text-slate-200">{req.venueId?.name}</strong> • 
                    Date: <strong>{new Date(req.requestedDate).toLocaleDateString()}</strong> ({req.startTime} - {req.endTime})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                    req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {req.status}
                  </span>

                  {user?.role === 'ADMIN' && req.status === 'PENDING' && (
                    <div className="flex gap-1.5 ml-2">
                      <button
                        onClick={() => handleReviewSlot(req._id, 'REJECT', 'Slot Conflict')}
                        className="px-3 py-1.5 bg-rose-100 text-rose-700 font-bold rounded-xl text-[11px]"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleReviewSlot(req._id, 'APPROVE', 'Venue Allocated')}
                        className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-[11px] shadow"
                      >
                        Approve Slot
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Venue Modal */}
      {showAddVenue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Register New Institutional Venue</h3>
            <form onSubmit={handleCreateVenue} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Venue Name</label>
                <input
                  type="text" required placeholder="e.g. Mechanical IoT Innovation Lab"
                  value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Venue Code</label>
                  <input
                    type="text" required placeholder="e.g. LAB-ME-02"
                    value={newVenue.code} onChange={(e) => setNewVenue({ ...newVenue, code: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Capacity</label>
                  <input
                    type="number" required
                    value={newVenue.capacity} onChange={(e) => setNewVenue({ ...newVenue, capacity: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">Location / Block</label>
                <input
                  type="text" required placeholder="e.g. Mechanical Wing 2nd Floor"
                  value={newVenue.location} onChange={(e) => setNewVenue({ ...newVenue, location: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowAddVenue(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-rcpit-600 text-white font-bold rounded-xl shadow">Save Venue</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SlotManagement;
