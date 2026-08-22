import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('rcpit_theme') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('rcpit_theme', theme);
  }, [theme]);

  const toggleTheme = (e) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';

    // 1. Calculate origin point (x, y) centered on the appearance toggle button icon
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    if (e && typeof e.clientX === 'number' && (e.clientX !== 0 || e.clientY !== 0)) {
      x = e.clientX;
      y = e.clientY;
    } else if (e && e.currentTarget && typeof e.currentTarget.getBoundingClientRect === 'function') {
      const rect = e.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    // 2. Maximum radius required to cover the screen from origin (x, y)
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // 3. Smooth Circular Motion View Transition API (Modern Chrome, Edge, Safari 18+)
    if (typeof document !== 'undefined' && document.startViewTransition) {
      const transition = document.startViewTransition(() => {
        setTheme(nextTheme);
        const root = document.documentElement;
        if (nextTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        localStorage.setItem('rcpit_theme', nextTheme);
      });

      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ];

        document.documentElement.animate(
          {
            clipPath: clipPath
          },
          {
            duration: 650,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      });
      return;
    }

    // 4. Fallback Circular Reveal Animation for Browsers without startViewTransition
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '999999';
    overlay.style.backgroundColor = nextTheme === 'dark' ? '#020617' : '#f8fafc';
    overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    overlay.style.transition = 'clip-path 600ms cubic-bezier(0.4, 0, 0.2, 1)';
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.clipPath = `circle(${endRadius}px at ${x}px ${y}px)`;
    });

    setTimeout(() => {
      const root = document.documentElement;
      if (nextTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      setTheme(nextTheme);
      localStorage.setItem('rcpit_theme', nextTheme);

      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 200ms ease';
      setTimeout(() => {
        overlay.remove();
      }, 200);
    }, 450);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
