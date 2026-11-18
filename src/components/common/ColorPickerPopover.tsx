import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  presets?: string[];
}

const DEFAULT_PRESETS = [
  '#FFFFFF', // White
  '#F8FAFC', // Slate 50
  '#F1F5F9', // Slate 100
  '#E2E8F0', // Slate 200
  '#DCFCE7', // Mint green (Completed)
  '#BBF7D0', // Green 200
  '#FEF3C7', // Soft amber (Waiting)
  '#FDE68A', // Amber 200
  '#FEE2E2', // Pale red (1 day)
  '#FCA5A5', // Coral (2-3 days)
  '#F87171', // Red 400 (4-6 days)
  '#DC2626', // Crimson 600 (7+ days)
  '#DBEAFE', // Blue 100
  '#BFDBFE', // Blue 200
  '#EDE9FE', // Purple 100
  '#DDD6FE', // Purple 200
  '#FCE7F3', // Pink 100
  '#1E293B', // Dark slate text
  '#166534', // Green text
  '#92400E', // Amber text
  '#991B1B', // Red text
  '#4338CA', // Indigo text
];

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  color,
  onChange,
  label,
  presets = DEFAULT_PRESETS,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState(color);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Update customInput if color prop changes externally
  useEffect(() => {
    setCustomInput(color);
  }, [color]);

  // Calculate dynamic unconstrained viewport coordinates
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 268;
    const popoverHeight = 240;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(16, rect.right - popoverWidth);
    }

    let top = rect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - 16 && rect.top > popoverHeight + 16) {
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

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const handleSelect = (c: string) => {
    setCustomInput(c);
    onChange(c);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      onChange(val);
    }
  };

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-1.5">
        {label && <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>}
        <button
          ref={triggerRef}
          type="button"
          onClick={handleOpenToggle}
          className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg shadow-xs hover:border-[#ff2d5f] focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-xs transition-colors cursor-pointer"
        >
          <span
            className="w-4 h-4 rounded-md border border-slate-300 dark:border-[#142552] shadow-2xs flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 uppercase">
            {color}
          </span>
          <Palette className="w-3 h-3 text-slate-400 dark:text-slate-400" />
        </button>
      </div>

      {isOpen &&
        createPortal(
          <>
            {/* Backdrop to close */}
            <div
              className="fixed inset-0 z-[99998] bg-black/10 dark:bg-black/40"
              onClick={() => setIsOpen(false)}
            />

            {/* Floating Popover Container */}
            <div
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                zIndex: 99999,
                width: '268px',
              }}
              className="p-3.5 bg-white dark:bg-[#050c21] border border-slate-200 dark:border-[#142552] rounded-2xl shadow-2xl dark:shadow-black/80 animate-in fade-in zoom-in-95 text-slate-900 dark:text-slate-100"
            >
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-[#142552]">
                <span className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Color Picker
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mb-3">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Custom Hex / Native Picker
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={handleHexChange}
                    placeholder="#FFFFFF"
                    className="w-full px-2.5 py-1 text-xs font-mono font-bold border border-slate-300 dark:border-[#142552] bg-slate-50 dark:bg-[#020612] rounded-lg focus:border-[#ff2d5f] focus:outline-none text-slate-900 dark:text-white uppercase"
                  />
                  <input
                    type="color"
                    value={color.startsWith('#') && color.length === 7 ? color : '#FFFFFF'}
                    onChange={(e) => handleSelect(e.target.value)}
                    className="w-8 h-8 p-0.5 border border-slate-300 dark:border-[#142552] rounded-lg cursor-pointer bg-transparent flex-shrink-0"
                    title="Click for full spectrum color picker"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  Preset Palette Swatches
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelect(preset)}
                      className={cn(
                        'w-7 h-7 rounded-lg border flex items-center justify-center transition-all hover:scale-110 shadow-2xs cursor-pointer',
                        color.toLowerCase() === preset.toLowerCase()
                          ? 'border-[#ff2d5f] ring-2 ring-[#ff2d5f]/50 scale-105'
                          : 'border-slate-200 dark:border-[#142552] hover:border-slate-400'
                      )}
                      style={{ backgroundColor: preset }}
                      title={preset}
                    >
                      {color.toLowerCase() === preset.toLowerCase() && (
                        <Check
                          className={cn(
                            'w-3.5 h-3.5 stroke-[2.5]',
                            preset === '#FFFFFF' || preset === '#DCFCE7' || preset === '#FEF3C7' || preset === '#FEE2E2'
                              ? 'text-slate-900'
                              : 'text-white'
                          )}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
};
