import React, { useState } from 'react';
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

  const selectedDate = (() => {
    if (!value) return undefined;
    try {
      const d = parseISO(value);
      return isValid(d) ? d : undefined;
    } catch {
      return undefined;
    }
  })();

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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-lg shadow-2xs hover:border-slate-400 dark:hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200 transition-colors',
          buttonClassName
        )}
      >
        {showIcon && <CalendarIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
        <span>{displayText}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 z-50 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl dark:shadow-2xl dark:shadow-black/60 animate-in fade-in zoom-in-95 dark:text-slate-100">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
            />
          </div>
        </>
      )}
    </div>
  );
};
