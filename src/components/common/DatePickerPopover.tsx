import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DatePickerPopoverProps {
  value: string; // "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  className?: string;
  buttonClassName?: string;
  showIcon?: boolean;
}

export const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({
  value,
  onChange,
  className,
  buttonClassName,
  showIcon = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const selectedDate = (() => {
    if (!value) return undefined;
    try {
      const d = parseISO(value);
      return isValid(d) ? d : undefined;
    } catch {
      return undefined;
    }
  })();

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const popoverWidth = 280;
    const popoverHeight = 320;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }

    let top = rect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - 12 && rect.top > popoverHeight + 12) {
      top = rect.top - popoverHeight - 6;
    }

    setCoords({ top, left });
  };

  const handleOpenToggle = () => {
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, 'yyyy-MM-dd'));
      setIsOpen(false);
    }
  };

  const displayText = selectedDate ? format(selectedDate, 'dd-MMM-yyyy') : 'Select Date';

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpenToggle}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-lg shadow-2xs hover:border-slate-400 dark:hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer',
          buttonClassName
        )}
      >
        {showIcon && <CalendarIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
        <span>{displayText}</span>
      </button>

      {isOpen &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[99998]" onClick={() => setIsOpen(false)} />
            <div
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                zIndex: 99999,
              }}
              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl dark:shadow-black/70 animate-in fade-in zoom-in-95 dark:text-slate-100"
            >
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleSelect}
              />
              <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => handleSelect(new Date())}
                  className="font-bold text-[#ff2d5f] hover:underline px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-[#ff2d5f]/10 cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
};
