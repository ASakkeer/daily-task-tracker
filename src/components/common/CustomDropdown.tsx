import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CustomDropdownOption {
  value: string;
  label: string;
  badge?: string;
  color?: string;
  textColor?: string;
  avatarColor?: string;
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
  direction = 'down',
  pillMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative inline-block w-full', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={selectedOption ? selectedOption.label : placeholder}
        style={
          pillMode && selectedOption?.color
            ? {
                backgroundColor: selectedOption.color,
                color: selectedOption.textColor || '#0F172A',
              }
            : undefined
        }
        className={cn(
          'w-full flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer select-none',
          pillMode
            ? 'shadow-xs border-transparent'
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

      {isOpen && (
        <div
          className={cn(
            'absolute z-[100] min-w-full w-max max-w-[420px] bg-white dark:bg-[#050c21] border border-slate-200 dark:border-[#142552] rounded-xl shadow-2xl dark:shadow-black/80 p-1 text-xs animate-in fade-in zoom-in-95',
            direction === 'up' ? 'bottom-full mb-1.5' : 'mt-1',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName
          )}
        >
          <div className="max-h-60 overflow-y-auto space-y-0.5 no-scrollbar">
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
                  <div className="flex items-center gap-2 whitespace-nowrap flex-1">
                    {opt.avatarColor && (
                      <span
                        className="w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: opt.avatarColor }}
                      >
                        {opt.label.charAt(0).toUpperCase()}
                      </span>
                    )}

                    {opt.color && (
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap"
                        style={{
                          backgroundColor: opt.color,
                          color: opt.textColor || '#0F172A',
                        }}
                      >
                        {opt.label}
                      </span>
                    )}

                    {!opt.color && <span className="whitespace-nowrap">{opt.label}</span>}
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 text-[#ff2d5f] stroke-[3] flex-shrink-0 ml-1.5" />}
                </button>
              );
            }))}
          </div>
        </div>
      )}
    </div>
  );
};
