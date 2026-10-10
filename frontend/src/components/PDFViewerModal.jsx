import React, { useState, useEffect, useRef } from 'react';
import { X, Download, FileText, ExternalLink, RefreshCw, Layers, AlertTriangle, Loader2 } from 'lucide-react';
import api, { getApiUrl } from '../api/client';

export const PDFViewerModal = ({ isOpen, onClose, activityId, pdfType = 'activity' }) => {
  const [versions, setVersions] = useState([]);
  const [selectedVersionUrl, setSelectedVersionUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [error, setError] = useState(null);

  const blobUrlRef = useRef(null);

  const cleanupBlob = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  const loadPdfBlob = async (targetEndpoint) => {
    if (!targetEndpoint) return;
    try {
      setLoadingPdf(true);
      setError(null);

      const token = localStorage.getItem('rcpit_token') || localStorage.getItem('token');
      const url = getApiUrl(targetEndpoint);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        let errMessage = `Server returned status ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.message) errMessage = errData.message;
        } catch (_) {}
        throw new Error(errMessage);
      }

      const blob = await res.blob();
      cleanupBlob();

      const objectUrl = URL.createObjectURL(blob);
      blobUrlRef.current = objectUrl;
      setPdfBlobUrl(objectUrl);
    } catch (err) {
      console.error('Failed to load PDF blob:', err);
      setError(err.message || 'Unable to generate or render official PDF preview.');
    } finally {
      setLoadingPdf(false);
    }
  };

  const fetchVersionsAndLoad = async () => {
    if (!activityId) return;
    try {
      const res = await api.get(`/activities/${activityId}/report/pdf/versions`).catch(() => ({ success: false }));
      if (res && res.success && res.versions?.length > 0) {
        setVersions(res.versions);
        const latestUrl = res.versions[0].fileUrl;
        setSelectedVersionUrl(latestUrl);
        await loadPdfBlob(latestUrl);
      } else {
        const defaultEndpoint = `/api/activities/${activityId}/report/pdf`;
        setSelectedVersionUrl(defaultEndpoint);
        await loadPdfBlob(defaultEndpoint);
      }
    } catch (err) {
      const fallbackEndpoint = `/api/activities/${activityId}/report/pdf`;
      setSelectedVersionUrl(fallbackEndpoint);
      await loadPdfBlob(fallbackEndpoint);
    }
  };

  useEffect(() => {
    if (isOpen && activityId) {
      fetchVersionsAndLoad();
    } else {
      cleanupBlob();
      setPdfBlobUrl(null);
      setError(null);
    }

    return () => {
      cleanupBlob();
    };
  }, [isOpen, activityId]);

  const handleVersionChange = async (url) => {
    setSelectedVersionUrl(url);
    await loadPdfBlob(url);
  };

  const handleGenerateNewVersion = async () => {
    try {
      setGenerating(true);
      setError(null);
      const res = await api.post(`/activities/${activityId}/report/pdf/generate`);
      if (res.success) {
        await fetchVersionsAndLoad();
      } else {
        setError(res.message || 'Failed to generate new PDF version');
      }
    } catch (err) {
      setError(err.message || 'Error occurred while generating PDF');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen || !activityId) return null;

  const token = localStorage.getItem('rcpit_token') || localStorage.getItem('token');
  const directEndpoint = selectedVersionUrl || `/api/activities/${activityId}/report/pdf`;
  const directDownloadUrl = getApiUrl(`${directEndpoint}${directEndpoint.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="w-full max-w-5xl h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-rcpit-600" />
            <div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Official Institutional PDF Report Preview
              </h4>
              <p className="text-[10px] text-slate-400">NAAC / NBA Accreditation Quality Ready Record • RCPIT Shirpur</p>
            </div>

            {versions.length > 0 && (
              <div className="flex items-center gap-1.5 ml-4">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedVersionUrl}
                  onChange={(e) => handleVersionChange(e.target.value)}
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
              disabled={generating || loadingPdf}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Regenerating...' : 'Regenerate PDF'}
            </button>

            <a
              href={pdfBlobUrl || directDownloadUrl}
              download={`ActivityReport-${activityId}.pdf`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open / Download
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Embedded PDF View Body */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-3 relative flex items-center justify-center">
          {loadingPdf ? (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-rcpit-600" />
              <p className="text-xs font-bold">Compiling & Rendering Official RCPIT Activity PDF...</p>
              <span className="text-[10px] text-slate-400">Fetching departmental personnel, attendance registers & signatures</span>
            </div>
          ) : error ? (
            <div className="max-w-md p-6 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl shadow-xl text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">PDF Generation Notice</h5>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{error}</p>
              <button
                onClick={() => fetchVersionsAndLoad()}
                className="px-4 py-2 bg-rcpit-600 hover:bg-rcpit-500 text-white text-xs font-bold rounded-xl transition-all shadow"
              >
                Retry Generation
              </button>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              title="Official Institutional PDF Report Preview"
              className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner bg-white"
            />
          ) : (
            <div className="text-xs text-slate-400">No PDF content available to render.</div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PDFViewerModal;
