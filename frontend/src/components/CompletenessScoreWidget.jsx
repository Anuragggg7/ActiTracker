import React from 'react';
import { CheckCircle, XCircle, Award } from 'lucide-react';

export const CompletenessScoreWidget = ({ score = 0, checklist = [] }) => {
  const isHigh = score >= 80;
  const isMed = score >= 50 && score < 80;

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-rcpit-600" />
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Documentation Completeness
          </h4>
        </div>
        <span className={`text-lg font-black ${
          isHigh ? 'text-emerald-600' : isMed ? 'text-amber-600' : 'text-rose-600'
        }`}>
          {score}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isHigh ? 'bg-emerald-500' : isMed ? 'bg-amber-500' : 'bg-rose-500'
          }`}
          style={{ width: `${score}%` }}
        ></div>
      </div>

      {/* Checklist Breakdown */}
      {checklist && checklist.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Verification Checklist
          </p>
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                {item.done ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span className={item.done ? 'line-through text-slate-400' : 'font-medium'}>
                  {item.label}
                </span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">+{item.weight}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompletenessScoreWidget;
