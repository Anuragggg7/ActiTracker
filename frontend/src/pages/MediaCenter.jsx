import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { 
  Image as ImageIcon, 
  Video, 
  MapPin, 
  Search, 
  Calendar, 
  Filter, 
  Upload, 
  ExternalLink,
  Layers,
  Grid,
  Building,
  Plus,
  X,
  Sparkles,
  Camera
} from 'lucide-react';

export const MediaCenter = () => {
  const { showToast } = useNotifications();
  const [mediaItems, setMediaItems] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('EVENT_ALBUMS'); // 'EVENT_ALBUMS' or 'ALL_GRID'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'image', 'video'
  const [search, setSearch] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null); // Lightbox modal state

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mediaRes, actRes] = await Promise.all([
        api.get('/media'),
        api.get('/activities')
      ]);

      if (mediaRes.success) {
        setMediaItems(mediaRes.media || []);
      }
      if (actRes.success) {
        setActivities(actRes.activities || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch media repository', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter media items
  const filteredMedia = mediaItems.filter(item => {
    const matchesSearch = item.caption?.toLowerCase().includes(search.toLowerCase()) ||
                          item.geotagLocation?.toLowerCase().includes(search.toLowerCase()) ||
                          item.activityId?.title?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || item.mediaType === typeFilter;
    return matchesSearch && matchesType;
  });

  // Group media items by Activity ID
  const eventMediaGroups = activities.map(act => {
    const actMedia = filteredMedia.filter(m => {
      const mActId = m.activityId?._id || m.activityId;
      return mActId?.toString() === act._id?.toString();
    });
    return {
      activity: act,
      media: actMedia
    };
  }).filter(group => {
    if (!search) return true;
    return group.activity.title?.toLowerCase().includes(search.toLowerCase()) ||
           group.media.length > 0;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-rcpit-900 via-rcpit-800 to-rcpit-950 text-white shadow-2xl relative overflow-hidden">
        <div className="space-y-1 z-10">
          <span className="text-[10px] font-black uppercase tracking-widest text-sky-300 bg-sky-950/80 px-3 py-1 rounded-full border border-sky-800 backdrop-blur-md inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-sky-400" /> Institutional Archival Gallery
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-2 flex items-center gap-3">
            <ImageIcon className="w-7 h-7 text-sky-400" /> Activity Media Repository
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Event-wise media albums, geo-tagged high-resolution photographs & video recordings across RCPIT departments.
          </p>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="z-10 flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <button
            onClick={() => setViewMode('EVENT_ALBUMS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'EVENT_ALBUMS'
                ? 'bg-rcpit-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Event Albums
          </button>
          <button
            onClick={() => setViewMode('ALL_GRID')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'ALL_GRID'
                ? 'bg-rcpit-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> All Media Grid
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by event title, caption, or geotag location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rcpit-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Media Type:</span>
          {[
            { id: 'ALL', label: 'All Assets' },
            { id: 'image', label: 'Photos (JPG/PNG)' },
            { id: 'video', label: 'Videos (MP4)' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                typeFilter === t.id
                  ? 'bg-rcpit-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT SECTION */}
      {loading ? (
        <div className="py-16 text-center text-xs font-extrabold text-slate-400 uppercase tracking-widest">
          Loading Event Media Albums...
        </div>
      ) : viewMode === 'EVENT_ALBUMS' ? (
        /* EVENT ALBUMS VIEW (Media Separated per Event) */
        <div className="space-y-8">
          {eventMediaGroups.length === 0 ? (
            <div className="glass-card p-12 text-center text-xs text-slate-500 space-y-2">
              <Camera className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-bold">No event albums match your search filters.</p>
            </div>
          ) : (
            eventMediaGroups.map(({ activity, media: actMedia }) => (
              <div 
                key={activity._id} 
                className="glass-card p-6 border border-slate-200 dark:border-slate-800 space-y-4 rounded-3xl hover:border-rcpit-500/40 transition-colors shadow-lg"
              >
                {/* Event Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rcpit-100 text-rcpit-700 dark:bg-rcpit-950 dark:text-rcpit-300 border border-rcpit-200 dark:border-rcpit-800">
                        {activity.departmentId?.name || 'Academic Dept'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {activity.category}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-rcpit-500" />
                        {new Date(activity.date).toLocaleDateString()}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {activity.title}
                    </h2>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Venue: <span className="font-semibold text-slate-700 dark:text-slate-300">{activity.venueName || 'RCPIT Campus'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      📸 {actMedia.length} {actMedia.length === 1 ? 'Asset' : 'Assets'}
                    </span>
                    <Link
                      to={`/activities/${activity._id}`}
                      className="px-3.5 py-2 rounded-xl bg-rcpit-600 hover:bg-rcpit-500 text-white text-xs font-bold shadow flex items-center gap-1.5 transition-all"
                    >
                      <span>Event Page</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Event Photos & Videos Grid */}
                {actMedia.length === 0 ? (
                  <div className="py-8 px-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <p className="text-xs text-slate-500 font-medium">
                      No photo or video uploads recorded for this event yet.
                    </p>
                    <Link
                      to={`/activities/${activity._id}`}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rcpit-100 text-rcpit-700 dark:text-rcpit-300 font-bold text-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Upload Event Photos
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {actMedia.map((item) => (
                      <div 
                        key={item._id}
                        onClick={() => setSelectedMedia(item)}
                        className="group relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md cursor-pointer hover:shadow-xl transition-all"
                      >
                        <div className="h-44 w-full relative overflow-hidden">
                          {item.mediaType === 'video' ? (
                            <video
                              src={item.url}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={item.url}
                              alt={item.caption || activity.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 text-white text-[9px] font-black uppercase tracking-wider backdrop-blur-sm">
                            {item.mediaType === 'video' ? '🎬 VIDEO' : '📸 PHOTO'}
                          </span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-900 space-y-1">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {item.caption || activity.title}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{item.geotagLocation || 'RCPIT Campus, Shirpur'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* ALL MEDIA GRID VIEW */
        <div>
          {filteredMedia.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No matching photographs or video recordings uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredMedia.map((item) => (
                <div 
                  key={item._id}
                  onClick={() => setSelectedMedia(item)}
                  className="group glass-card overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative h-48 bg-slate-900 overflow-hidden">
                    {item.mediaType === 'video' ? (
                      <video src={item.url} className="w-full h-full object-cover" />
                    ) : (
                      <img
                        src={item.url}
                        alt={item.caption || 'Event Media'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-slate-950/80 text-white text-[9px] font-black uppercase tracking-wider backdrop-blur-sm">
                      {item.mediaType === 'video' ? '🎬 VIDEO' : '📸 PHOTO'}
                    </span>
                  </div>

                  <div className="p-4 space-y-1.5 text-xs flex-1 flex flex-col justify-between">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white truncate">
                        {item.caption || 'Institutional Activity Media'}
                      </p>
                      {item.activityId?.title && (
                        <p className="text-[11px] text-rcpit-600 dark:text-rcpit-400 font-bold truncate">
                          {item.activityId.title}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{item.geotagLocation || 'RCPIT Campus, Shirpur'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Uploaded {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LIGHTBOX PREVIEW MODAL */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-slate-950/80 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Media Display */}
            <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] max-h-[65vh]">
              {selectedMedia.mediaType === 'video' ? (
                <video
                  src={selectedMedia.url}
                  controls
                  autoPlay
                  className="max-h-[65vh] w-auto max-w-full object-contain"
                />
              ) : (
                <img
                  src={selectedMedia.url}
                  alt={selectedMedia.caption || 'Event Media'}
                  className="max-h-[65vh] w-auto max-w-full object-contain"
                />
              )}
            </div>

            {/* Media Information Footer */}
            <div className="p-6 bg-slate-900 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {selectedMedia.caption || 'Event High-Resolution Photograph'}
                  </h3>
                  {selectedMedia.activityId?.title && (
                    <p className="text-xs text-rcpit-400 font-bold mt-0.5">
                      Event: {selectedMedia.activityId.title} ({selectedMedia.activityId.departmentId?.name})
                    </p>
                  )}
                </div>

                {selectedMedia.activityId?._id && (
                  <Link
                    to={`/activities/${selectedMedia.activityId._id}`}
                    onClick={() => setSelectedMedia(null)}
                    className="px-3.5 py-2 rounded-xl bg-rcpit-600 hover:bg-rcpit-500 text-white font-bold text-xs flex items-center gap-1.5 flex-shrink-0"
                  >
                    <span>View Event Page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-4 pt-2 text-[11px] text-slate-400 border-t border-slate-800">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <MapPin className="w-3.5 h-3.5" /> {selectedMedia.geotagLocation || 'RCPIT Campus, Shirpur'}
                </span>
                <span>Uploaded {new Date(selectedMedia.createdAt).toLocaleDateString()}</span>
                {selectedMedia.uploadedBy?.name && (
                  <span>By {selectedMedia.uploadedBy.name}</span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default MediaCenter;
