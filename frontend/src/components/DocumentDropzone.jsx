import React, { useState, useRef } from 'react';
import api from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Loader2, Plus } from 'lucide-react';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.pptx', '.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const DocumentDropzone = ({ activityId, onUploadSuccess }) => {
  const { showToast } = useNotifications();
  const fileInputRef = useRef(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [documentType, setDocumentType] = useState('EVENT_REPORT');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const validateAndAddFiles = (fileList) => {
    const filesArray = Array.from(fileList);
    const validFiles = [];

    for (const file of filesArray) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        showToast(`"${file.name}" has an unsupported format. Supported: PDF, DOCX, XLSX, PPTX, JPG, PNG`, 'warning');
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(`"${file.name}" exceeds the 10MB file size limit.`, 'warning');
        continue;
      }

      // Avoid duplicates in pending queue
      const alreadySelected = selectedFiles.some(f => f.name === file.name && f.size === file.size);
      if (!alreadySelected) {
        validFiles.push({
          file,
          name: file.name,
          size: file.size,
          extension: ext.replace('.', '').toUpperCase(),
          status: 'READY'
        });
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
    }
    // Reset file input so same file can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      showToast('Please select or drag at least one file to upload.', 'warning');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      let successCount = 0;
      const total = selectedFiles.length;

      for (let i = 0; i < total; i++) {
        const item = selectedFiles[i];
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('documentType', documentType);
        formData.append('description', description || `${documentType.replace(/_/g, ' ')} - ${item.name}`);

        const res = await api.post(`/activities/${activityId}/documents`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.success) {
          successCount++;
          setUploadProgress(Math.round(((i + 1) / total) * 100));
        }
      }

      showToast(`Successfully uploaded ${successCount} document(s).`, 'success');
      setSelectedFiles([]);
      setDescription('');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'File upload failed', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Category and Notes Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Document Category / Classification <span className="text-rcpit-600">*</span>
          </label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
          >
            <option value="EVENT_REPORT">Event Report Document</option>
            <option value="PERMISSION_LETTER">Permission Letter</option>
            <option value="INVITATION">Invitation Card / Brochure</option>
            <option value="ATTENDANCE">Attendance Register Sheet</option>
            <option value="CERTIFICATE">Certificates / Awards Sample</option>
            <option value="POSTER">Posters & Banners</option>
            <option value="SUPPORTING_DOCUMENT">Supporting Document</option>
            <option value="OTHER">Other Academic Record</option>
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Document Description / Remarks
          </label>
          <input
            type="text"
            placeholder="e.g. Approved copy signed by Principal"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
          />
        </div>
      </div>

      {/* Modern Drag-and-Drop Dropzone Box (Change 2) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
          isDragOver
            ? 'border-rcpit-500 bg-rcpit-50/80 dark:bg-rcpit-950/40 shadow-inner'
            : 'border-slate-300 dark:border-slate-700 hover:border-rcpit-500 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className={`p-4 rounded-2xl ${isDragOver ? 'bg-rcpit-600 text-white animate-bounce' : 'bg-rcpit-50 dark:bg-slate-800 text-rcpit-600'}`}>
          <UploadCloud className="w-8 h-8" />
        </div>

        <div>
          <h4 className="font-black text-sm text-slate-900 dark:text-white">
            Drag & Drop Your Files Here
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            or <span className="text-rcpit-600 dark:text-rcpit-400 font-bold underline">click to browse files</span> from your computer
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] text-slate-400">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold">PDF</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold">DOCX</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold">XLSX</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold">PPTX</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold">JPG/PNG</span>
          <span>• Max 10MB per file</span>
        </div>
      </div>

      {/* Selected Pending Files Queue */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Pending Files to Upload ({selectedFiles.length})</span>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              className="text-rose-500 hover:underline text-[11px]"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {selectedFiles.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2.5 truncate max-w-[80%]">
                  <span className="px-2 py-1 rounded bg-rcpit-100 text-rcpit-700 dark:bg-rcpit-950 dark:text-rcpit-300 font-mono text-[10px] font-black shrink-0">
                    {item.extension}
                  </span>
                  <div className="truncate">
                    <p className="font-extrabold text-slate-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{formatFileSize(item.size)}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => removeFile(idx)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Remove from upload queue"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Progress Bar during upload */}
          {uploading && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] font-bold text-rcpit-600">
                <span>Uploading files...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-rcpit-600 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={uploading}
              onClick={handleUploadAll}
              className="px-5 py-2.5 bg-rcpit-600 hover:bg-rcpit-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading {selectedFiles.length} File(s)...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" /> Upload {selectedFiles.length} Selected File(s)
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default DocumentDropzone;

