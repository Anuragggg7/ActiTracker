import React, { Children, useEffect, useState, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function AnimatedBackground({
  children,
  defaultValue,
  value,
  onValueChange,
  className = '',
  containerClassName = '',
  transition = {
    type: 'spring',
    bounce: 0.2,
    duration: 0.3,
  },
  enableHover = false,
}) {
  const [activeId, setActiveId] = useState(value !== undefined ? value : defaultValue);
  const uniqueId = useId();

  useEffect(() => {
    if (value !== undefined) {
      setActiveId(value);
    }
  }, [value]);

  useEffect(() => {
    if (value === undefined && defaultValue !== undefined) {
      setActiveId(defaultValue);
    }
  }, [defaultValue, value]);

  const handleSetActiveId = (id) => {
    setActiveId(id);
    if (onValueChange) {
      onValueChange(id);
    }
  };

  return (
    <div
      className={`relative ${containerClassName || 'flex items-center w-full'}`}
      onMouseLeave={() => {
        if (enableHover) {
          if (value !== undefined) {
            setActiveId(value);
          } else if (defaultValue !== undefined) {
            setActiveId(defaultValue);
          } else {
            setActiveId(null);
          }
        }
      }}
    >
      {Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return null;

        const id = child.props['data-id'];
        const isSelected = activeId === id;

        const handleInteraction = (e) => {
          if (child.props.onClick) {
            child.props.onClick(e);
          }
          if (!enableHover) {
            handleSetActiveId(id);
          }
        };

        const handleMouseEnter = (e) => {
          if (child.props.onMouseEnter) {
            child.props.onMouseEnter(e);
          }
          if (enableHover) {
            handleSetActiveId(id);
          }
        };

        return (
          <div
            key={id || index}
            className="relative inline-flex flex-1 items-center justify-center h-full w-full"
            onMouseEnter={handleMouseEnter}
            onClick={handleInteraction}
          >
            <AnimatePresence initial={false}>
              {isSelected && (
                <motion.div
                  layoutId={`animated-bg-${uniqueId}`}
                  className={`absolute inset-0 z-0 ${className}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={transition}
                />
              )}
            </AnimatePresence>
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              {child}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AnimatedBackground;
