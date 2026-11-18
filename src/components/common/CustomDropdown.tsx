import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CustomDropdownOption {
  value: string;
  label: string;
  badge?: string;
  color?: string;
  textColor?: string;
  avatarColor?: string;
  className?: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomDropdownOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
  direction?: 'up' | 'down';
  pillMode?: boolean; // When true, button matches the active option's color (great for status cells)
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
  buttonClassName,
  menuClassName,
  align = 'left',
  direction,
  pillMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 160,
    maxHeight: 280,
  });

  const selectedOption = options.find((o) => o.value === value);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // If trigger button is completely scrolled off the visible viewport, close dropdown
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const minWidth = Math.max(rect.width, 160);
    const popoverWidth = minWidth;
    const estimatedHeight = Math.min(options.length * 36 + 16, 280);

    let left = align === 'right' ? rect.right - popoverWidth : rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldFlipUp =
      direction === 'up' || (spaceBelow < estimatedHeight + 10 && spaceAbove > spaceBelow);

    let top = rect.bottom + 4;
    let maxHeight = Math.min(spaceBelow - 16, 320);

    if (shouldFlipUp) {
      const topCalculated = rect.top - estimatedHeight - 4;
      top = Math.max(12, topCalculated);
      maxHeight = Math.min(spaceAbove - 16, 320);
    }

    setCoords({
      top,
      left,
      width: minWidth,
      maxHeight: Math.max(maxHeight, 120),
    });
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

    // Use capture: true so any scrolling container (like table overflow) triggers position update
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, options.length, direction, align]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative inline-block w-full', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpenToggle}
        title={selectedOption ? selectedOption.label : placeholder}
        style={
          pillMode && selectedOption?.color && !selectedOption?.className
            ? {
                backgroundColor: selectedOption.color,
                color: selectedOption.textColor || '#0F172A',
                borderColor: selectedOption.textColor ? `${selectedOption.textColor}40` : undefined,
              }
            : undefined
        }
        className={cn(
          'w-full flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer select-none',
          pillMode
            ? selectedOption?.className || 'shadow-xs border-transparent'
            : 'bg-white dark:bg-[#020612] text-slate-800 dark:text-slate-100 border-slate-300 dark:border-[#142552] hover:border-[#ff2d5f] focus:ring-1 focus:ring-[#ff2d5f] shadow-2xs',
          buttonClassName
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {selectedOption?.avatarColor && (
            <span
              className="w-3.5 h-3.5 rounded-full text-white text-[9px] font-black flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: selectedOption.avatarColor }}
            >
              {selectedOption.label.charAt(0).toUpperCase()}
            </span>
          )}

          {!pillMode && selectedOption?.color && (
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-slate-300 dark:border-slate-700"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}

          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0 transition-transform opacity-70',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen &&
        createPortal(
          <>
            {/* Transparent backdrop catching clicks outside to close cleanly */}
            <div
              className="fixed inset-0 z-[99998]"
              onClick={() => setIsOpen(false)}
            />

            {/* Unconstrained Floating Dropdown Menu */}
            <div
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${coords.width}px`,
                maxHeight: `${coords.maxHeight}px`,
                zIndex: 99999,
              }}
              className={cn(
                'bg-white dark:bg-[#050c21] border border-slate-200 dark:border-[#142552] rounded-xl shadow-2xl dark:shadow-black/80 p-1 text-xs animate-in fade-in zoom-in-95 flex flex-col',
                menuClassName
              )}
            >
              <div className="overflow-y-auto space-y-0.5 no-scrollbar flex-1">
                {options.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic text-center">
                    No options available
                  </div>
                ) : (
                  options.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                          'w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg text-left font-semibold transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-rose-50 dark:bg-[#ff2d5f]/15 text-rose-950 dark:text-[#ff2d5f] font-black'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#08122f]'
                        )}
                      >
                        <div className="flex items-center gap-2 whitespace-nowrap flex-1 truncate">
                          {opt.avatarColor && (
                            <span
                              className="w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: opt.avatarColor }}
                            >
                              {opt.label.charAt(0).toUpperCase()}
                            </span>
                          )}

                          {opt.className ? (
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap',
                                opt.className
                              )}
                            >
                              {opt.label}
                            </span>
                          ) : opt.color ? (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap"
                              style={{
                                backgroundColor: opt.color,
                                color: opt.textColor || '#0F172A',
                                borderColor: opt.textColor ? `${opt.textColor}40` : undefined,
                              }}
                            >
                              {opt.label}
                            </span>
                          ) : (
                            <span className="whitespace-nowrap truncate">{opt.label}</span>
                          )}
                        </div>

                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#ff2d5f] stroke-[3] flex-shrink-0 ml-1.5" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
};
