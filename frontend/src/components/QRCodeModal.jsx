import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, ExternalLink, ShieldCheck, Download } from 'lucide-react';

export const QRCodeModal = ({ isOpen, onClose, activity }) => {
  if (!isOpen || !activity) return null;

  const publicUrl = `${window.location.origin}/public/activity/${activity._id}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center space-y-5">
        
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rcpit-600 dark:text-rcpit-400 bg-rcpit-50 dark:bg-rcpit-950/60 px-3 py-1 rounded-full border border-rcpit-200 dark:border-rcpit-800">
            <ShieldCheck className="w-3.5 h-3.5" /> Official Verification QR
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h4 className="font-extrabold text-base text-slate-900 dark:text-white line-clamp-2">
            {activity.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Scan QR code to view public institutional verification page
          </p>
        </div>

        {/* QR SVG Container */}
        <div className="p-4 bg-white rounded-2xl border-2 border-slate-100 inline-block shadow-inner">
          <QRCodeSVG value={publicUrl} size={180} level="H" includeMargin />
        </div>

        <div className="pt-2 space-y-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 bg-rcpit-600 hover:bg-rcpit-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <ExternalLink className="w-4 h-4" /> Open Public Verification Page
          </a>
          <p className="text-[10px] text-slate-400">
            R. C. Patel Institute of Technology, Shirpur (RCPIT)
          </p>
        </div>

      </div>
    </div>
  );
};

export default QRCodeModal;
