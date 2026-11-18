import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface MultiSelectOption {
  id: string;
  label: string;
  color?: string;
  textColor?: string;
  avatarColor?: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = 'All',
  className,
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
    width: 220,
    maxHeight: 280,
  });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const popoverWidth = Math.max(rect.width, 240);
    const estimatedHeight = Math.min(options.length * 34 + 60, 280);

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldFlipUp = spaceBelow < estimatedHeight + 10 && spaceAbove > spaceBelow;

    let top = rect.bottom + 4;
    let maxHeight = Math.min(spaceBelow - 16, 320);

    if (shouldFlipUp) {
      top = Math.max(12, rect.top - estimatedHeight - 4);
      maxHeight = Math.min(spaceAbove - 16, 320);
    }

    setCoords({
      top,
      left,
      width: popoverWidth,
      maxHeight: Math.max(maxHeight, 140),
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

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, options.length]);

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.id));
  };

  const handleClear = () => {
    onChange([]);
  };

  const isAllSelected = selectedIds.length === options.length && options.length > 0;
  const isNoneSelected = selectedIds.length === 0;

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpenToggle}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer select-none',
          selectedIds.length > 0
            ? 'bg-rose-50 dark:bg-[#ff2d5f]/15 text-rose-950 dark:text-[#ff2d5f] border-rose-300 dark:border-[#ff2d5f]/40 shadow-xs'
            : 'bg-slate-50 dark:bg-[#020612] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#142552] hover:bg-slate-100 dark:hover:bg-[#08122f]'
        )}
      >
        <span>
          {selectedIds.length === 0
            ? placeholder
            : selectedIds.length === 1
            ? options.find((o) => o.id === selectedIds[0])?.label || placeholder
            : `${label} (${selectedIds.length})`}
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform text-slate-400',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen &&
        createPortal(
          <>
            {/* Backdrop to catch clicks outside */}
            <div
              className="fixed inset-0 z-[99998]"
              onClick={() => setIsOpen(false)}
            />

            {/* Floating Portal Menu */}
            <div
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${coords.width}px`,
                maxHeight: `${coords.maxHeight}px`,
                zIndex: 99999,
              }}
              className="bg-white dark:bg-[#050c21] border border-slate-200 dark:border-[#142552] rounded-xl shadow-2xl dark:shadow-black/70 p-2 text-xs animate-in fade-in zoom-in-95 flex flex-col"
            >
              {/* Header controls */}
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-[#142552]/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Filter by {label}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={isAllSelected}
                    className="text-rose-600 dark:text-[#ff2d5f] hover:underline disabled:opacity-30 cursor-pointer font-bold"
                  >
                    All
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isNoneSelected}
                    className="text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-30 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Options Checklist */}
              <div className="overflow-y-auto space-y-0.5 no-scrollbar flex-1">
                {options.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-400 dark:text-slate-500 italic text-center">
                    No {label.toLowerCase()} available
                  </div>
                ) : (
                  options.map((opt) => {
                    const isChecked = selectedIds.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        onClick={() => handleToggle(opt.id)}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs font-semibold',
                          isChecked
                            ? 'bg-rose-50/80 dark:bg-[#ff2d5f]/15 text-slate-900 dark:text-white'
                            : 'hover:bg-slate-100 dark:hover:bg-[#08122f] text-slate-700 dark:text-slate-300'
                        )}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                            isChecked
                              ? 'bg-[#ff2d5f] border-[#ff2d5f] text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#020612]'
                          )}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        {opt.avatarColor ? (
                          <span
                            className="w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: opt.avatarColor }}
                          >
                            {opt.label.charAt(0).toUpperCase()}
                          </span>
                        ) : opt.color ? (
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0 border border-slate-300 dark:border-slate-700"
                            style={{ backgroundColor: opt.color }}
                          />
                        ) : null}

                        <span className="whitespace-nowrap flex-1 truncate">{opt.label}</span>
                      </label>
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
