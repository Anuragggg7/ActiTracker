import React, { useState, useEffect } from 'react';
import { X, Download, FileText, ExternalLink, RefreshCw, Layers } from 'lucide-react';
import api, { getApiUrl } from '../api/client';

export const PDFViewerModal = ({ isOpen, onClose, activityId }) => {
  const [versions, setVersions] = useState([]);
  const [selectedVersionUrl, setSelectedVersionUrl] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchVersions = async () => {
    if (!activityId) return;
    try {
      const res = await api.get(`/activities/${activityId}/report/pdf/versions`);
      if (res.success && res.versions?.length > 0) {
        setVersions(res.versions);
        setSelectedVersionUrl(res.versions[0].fileUrl);
      } else {
        setSelectedVersionUrl(`/api/activities/${activityId}/report/pdf`);
      }
    } catch (err) {
      setSelectedVersionUrl(`/api/activities/${activityId}/report/pdf`);
    }
  };

  useEffect(() => {
    if (isOpen && activityId) {
      fetchVersions();
    }
  }, [isOpen, activityId]);

  const handleGenerateNewVersion = async () => {
    try {
      setGenerating(true);
      const res = await api.post(`/activities/${activityId}/report/pdf/generate`);
      if (res.success) {
        fetchVersions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen || !activityId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-rcpit-600" />
            <div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Official Institutional PDF Report Preview
              </h4>
              <p className="text-[10px] text-slate-400">NAAC/NBA Accreditation Ready Record</p>
            </div>

            {versions.length > 0 && (
              <div className="flex items-center gap-1.5 ml-4">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedVersionUrl}
                  onChange={(e) => setSelectedVersionUrl(e.target.value)}
                  className="p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  {versions.map((v) => (
                    <option key={v._id} value={v.fileUrl}>
                      Version {v.version} ({new Date(v.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateNewVersion}
              disabled={generating}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Regenerating...' : 'Regenerate PDF'}
            </button>
            <a
              href={getApiUrl(selectedVersionUrl || `/api/activities/${activityId}/report/pdf`)}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open / Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Embedded PDF iframe */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2">
          <iframe
            src={getApiUrl(selectedVersionUrl || `/api/activities/${activityId}/report/pdf`)}
            title="Official PDF Report Preview"
            className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner"
          />
        </div>

      </div>
    </div>
  );
};

export default PDFViewerModal;
