import React from 'react';

export const RcpitLogo = ({ size = 'md', variant = 'full' }) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const imgSizeClass = isSm ? 'w-8 h-8' : isLg ? 'w-14 h-14' : 'w-10 h-10';

  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative flex items-center justify-center shrink-0">
        <img
          src="/rcpit-logo.png"
          alt="ActiTracker Logo"
          className={`${imgSizeClass} object-contain filter drop-shadow-sm transition-transform hover:scale-105`}
        />
      </div>

      {variant !== 'icon-only' && (
        <div className="flex flex-col text-left justify-center">
          <span className={`font-black tracking-tight text-slate-900 dark:text-white leading-none ${
            isSm ? 'text-base' : isLg ? 'text-2xl' : 'text-lg'
          }`}>
            Acti<span className="text-rcpit-600 dark:text-rcpit-400">Tracker</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default RcpitLogo;
