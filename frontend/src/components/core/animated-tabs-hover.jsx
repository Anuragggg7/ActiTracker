import React, { useState } from 'react';
import { AnimatedBackground } from '@/components/core/animated-background';

export function AnimatedTabsHover({
  tabs = ['Home', 'About', 'Services', 'Contact'],
  onTabChange,
  activeTab,
  className = '',
}) {
  const [selectedTab, setSelectedTab] = useState(activeTab || tabs[0]);

  const handleTabClick = (tab) => {
    setSelectedTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <div className={`flex flex-row ${className}`}>
      <AnimatedBackground
        defaultValue={selectedTab}
        value={activeTab !== undefined ? activeTab : selectedTab}
        onValueChange={(val) => {
          if (val) {
            setSelectedTab(val);
            if (onTabChange) onTabChange(val);
          }
        }}
        className="rounded-lg bg-zinc-100 dark:bg-zinc-800"
        transition={{
          type: 'spring',
          bounce: 0.2,
          duration: 0.3,
        }}
        enableHover
      >
        {tabs.map((tab, index) => (
          <button
            key={index}
            data-id={tab}
            type="button"
            onClick={() => handleTabClick(tab)}
            className="px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors duration-300 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {tab}
          </button>
        ))}
      </AnimatedBackground>
    </div>
  );
}

export default AnimatedTabsHover;
