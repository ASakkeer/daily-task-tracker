import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Clock,
  Sparkles,
  Download,
  Plus,
  ArrowRight,
  Sliders,
  FileSpreadsheet,
  LayoutDashboard,
  Calendar as CalendarIcon,
  History,
  BookmarkCheck,
} from 'lucide-react';
import { ReportSnapshot, TaskRow, ReportSlot, ActiveView, AppMetadata } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateView: (view: ActiveView) => void;
  onSelectSlot: (slot: ReportSlot) => void;
  onOpenAddTask: () => void;
  onExportPng: () => void;
  onSelectTask?: (task: TaskRow) => void;
  currentReport?: ReportSnapshot | null;
  metadata: AppMetadata;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateView,
  onSelectSlot,
  onOpenAddTask,
  onExportPng,
  onSelectTask,
  currentReport,
  metadata,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by caller
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Search Tasks in active snapshot
  const tasks = currentReport?.tasks || [];
  const matchingTasks = query.trim()
    ? tasks.filter(
        (t) =>
          t.category.toLowerCase().includes(query.toLowerCase()) ||
          (t.notes && t.notes.toLowerCase().includes(query.toLowerCase()))
      )
    : tasks.slice(0, 4);

  // System Actions
  const actions = [
    {
      id: 'add_task',
      label: 'Create New Task Plan',
      category: 'Actions',
      icon: Plus,
      badge: 'N',
      run: () => {
        onOpenAddTask();
        onClose();
      },
    },
    {
      id: 'export_png',
      label: 'Export Retina PNG Image (3x)',
      category: 'Export',
      icon: Download,
      badge: 'E',
      run: () => {
        onExportPng();
        onClose();
      },
    },
    {
      id: 'slot_morning',
      label: 'Switch to Morning Slot',
      category: 'Navigation',
      icon: Clock,
      run: () => {
        onSelectSlot('MORNING');
        onClose();
      },
    },
    {
      id: 'slot_evening',
      label: 'Switch to Evening Slot',
      category: 'Navigation',
      icon: Clock,
      run: () => {
        onSelectSlot('EVENING');
        onClose();
      },
    },
    {
      id: 'view_report',
      label: 'Go to Report Builder Studio',
      category: 'Views',
      icon: FileSpreadsheet,
      run: () => {
        onNavigateView('report_builder');
        onClose();
      },
    },
    {
      id: 'view_dashboard',
      label: 'Go to Analytics & Velocity Dashboard',
      category: 'Views',
      icon: LayoutDashboard,
      run: () => {
        onNavigateView('dashboard');
        onClose();
      },
    },
    {
      id: 'view_calendar',
      label: 'Go to Monthly Reports Calendar',
      category: 'Views',
      icon: CalendarIcon,
      run: () => {
        onNavigateView('calendar');
        onClose();
      },
    },
    {
      id: 'view_settings',
      label: 'Configure Metadata & Settings Studio',
      category: 'Views',
      icon: Sliders,
      run: () => {
        onNavigateView('metadata');
        onClose();
      },
    },
    {
      id: 'view_backlog',
      label: 'Go to Work Item Backlog',
      category: 'Views',
      icon: BookmarkCheck,
      run: () => {
        onNavigateView('backlog');
        onClose();
      },
    },
    {
      id: 'view_audit',
      label: 'Go to System Audit & Activity Log',
      category: 'Views',
      icon: History,
      run: () => {
        onNavigateView('audit_log');
        onClose();
      },
    },
  ];

  const filteredActions = query.trim()
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          a.category.toLowerCase().includes(query.toLowerCase())
      )
    : actions;

  const totalItems = matchingTasks.length + filteredActions.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < matchingTasks.length) {
        const task = matchingTasks[selectedIndex];
        if (onSelectTask) onSelectTask(task);
        onClose();
      } else {
        const actionIdx = selectedIndex - matchingTasks.length;
        const act = filteredActions[actionIdx];
        if (act) act.run();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#050c21] border border-slate-200 dark:border-[#142552] rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-[#142552] flex items-center gap-3 bg-slate-50 dark:bg-[#020612]">
          <Search className="w-5 h-5 text-rose-600 dark:text-[#ff2d5f] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search tasks, jump to slots, or trigger AI..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-[#050c21] border border-slate-300 dark:border-[#142552] rounded shadow-xs font-bold">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto divide-y divide-slate-100 dark:divide-[#142552]/60">
          {/* Matching Tasks Section */}
          {matchingTasks.length > 0 && (
            <div className="p-2 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 block mb-1">
                Tasks in Current Snapshot ({matchingTasks.length})
              </span>
              {matchingTasks.map((t, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      if (onSelectTask) onSelectTask(t);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors text-left ${
                      isSelected
                        ? 'bg-rose-50 dark:bg-[#ff2d5f]/15 text-rose-950 dark:text-[#ff2d5f] border border-rose-300 dark:border-[#ff2d5f]/30 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#08122f]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="w-2 h-2 rounded-full bg-[#ff2d5f] flex-shrink-0" />
                      <span className="font-semibold truncate">{t.category}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        {t.completionPct}%
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Actions Section */}
          <div className="p-2 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 block mb-1">
              Commands &amp; Workflows
            </span>
            {filteredActions.map((act, idx) => {
              const itemIdx = matchingTasks.length + idx;
              const isSelected = selectedIndex === itemIdx;
              const Icon = act.icon;

              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={act.run}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors text-left ${
                    isSelected
                      ? 'bg-rose-50 dark:bg-[#ff2d5f]/15 text-rose-950 dark:text-[#ff2d5f] border border-rose-300 dark:border-[#ff2d5f]/30 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#08122f]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#08122f] text-rose-600 dark:text-[#ff2d5f] border border-slate-200 dark:border-[#142552]">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold">{act.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {act.category}
                    </span>
                    {act.badge && (
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded font-bold">
                        {act.badge}
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Shortcut Hints */}
        <div className="p-3 bg-slate-50 dark:bg-[#020612] border-t border-slate-200 dark:border-[#142552] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono text-slate-700 dark:text-slate-300 font-bold">↑↓</kbd> to navigate</span>
            <span><kbd className="font-mono text-slate-700 dark:text-slate-300 font-bold">↵</kbd> to select</span>
            <span><kbd className="font-mono text-slate-700 dark:text-slate-300 font-bold">ESC</kbd> to close</span>
          </div>
          <span className="text-rose-600 dark:text-[#ff2d5f] font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#ff2d5f]" /> AI Studio Spotlight
          </span>
        </div>
      </div>
    </div>
  );
};
