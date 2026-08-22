import React from 'react';
import { AnimatedBackground } from '@/components/core/animated-background';

export function AnimatedCardBackgroundHover({
  items,
  className = '',
  cardClassName = '',
}) {
  const DEFAULT_ITEMS = [
    {
      id: 1,
      title: 'Activity Proposals',
      description: 'Submit, draft & structure event proposals for departmental review.',
      badge: 'Core'
    },
    {
      id: 2,
      title: 'HOD Governance',
      description: 'Seamless approval workflows & budget authorization for HODs.',
      badge: 'RBAC'
    },
    {
      id: 3,
      title: 'Central Calendar',
      description: 'Conflict-free slot booking & venue allocation across RCPIT.',
      badge: 'Live'
    },
    {
      id: 4,
      title: 'NAAC & NIRF Reports',
      description: 'Automated document synthesis, evidence logs & accreditation metrics.',
      badge: 'NAAC'
    },
    {
      id: 5,
      title: 'QR Certificate Desk',
      description: 'Instant verified digital certificates with scannable QR verification.',
      badge: 'Verify'
    },
    {
      id: 6,
      title: 'Audit & Compliance',
      description: 'Immutable transaction logs & institutional activity tracking.',
      badge: 'Security'
    },
  ];

  const displayItems = items || DEFAULT_ITEMS;

  return (
    <div className={`w-full ${className}`}>
      <AnimatedBackground
        containerClassName="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-2"
        className="rounded-2xl bg-white/70 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-lg backdrop-blur-md"
        transition={{
          type: 'spring',
          bounce: 0.2,
          duration: 0.5,
        }}
        enableHover
      >
        {displayItems.map((item, index) => (
          <div key={item.id || index} data-id={`card-${item.id || index}`} className="w-full h-full">
            <div className={`flex select-none flex-col space-y-1.5 p-4 rounded-xl cursor-pointer transition-colors ${cardClassName}`}>
              <h3 className='text-sm font-black text-slate-800 dark:text-slate-100 flex items-center justify-between'>
                <span>{item.title}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rcpit-100 text-rcpit-700 dark:bg-rcpit-950 dark:text-rcpit-300 border border-rcpit-300/40">
                    {item.badge}
                  </span>
                )}
              </h3>
              <p className='text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed'>
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </AnimatedBackground>
    </div>
  );
}

export default AnimatedCardBackgroundHover;
