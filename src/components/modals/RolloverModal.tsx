import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  RefreshCw,
  Check,
  CheckSquare,
  Square,
  Calendar,
  Clock,
  ArrowRight,
  Sun,
  Moon,
  Search,
  ChevronDown,
  Sparkles,
  CalendarDays,
  Layers,
} from 'lucide-react';
import { AppMetadata, ReportSnapshot, TaskRow, ReportSlot } from '../../types';
import { formatDateSafe } from '../../utils/date';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { cn } from '../../utils/cn';

interface RolloverModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableReports: ReportSnapshot[];
  currentTasks?: TaskRow[];
  metadata: AppMetadata;
  activeSlot?: string;
  activeDate?: string;
  onRollover: (tasks: TaskRow[]) => void;
}

export const RolloverModal: React.FC<RolloverModalProps> = ({
  isOpen,
  onClose,
  availableReports,
  currentTasks = [],
  metadata,
  activeSlot = 'MORNING',
  activeDate = '',
  onRollover,
}) => {
  // Sort reports chronologically descending (newest first).
  // On the same date, EVENING comes before MORNING so latest tasks are always at top.
  const eligibleReports = useMemo(() => {
    const valid = availableReports.filter((r) => r.tasks && r.tasks.length > 0);
    return valid.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      const slotRank: Record<string, number> = { EVENING: 3, AFTERNOON: 2, MORNING: 1 };
      return (slotRank[b.slot] || 0) - (slotRank[a.slot] || 0);
    });
  }, [availableReports]);

  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options
  const [excludeCompleted, setExcludeCompleted] = useState(true);
  const [excludeExisting, setExcludeExisting] = useState(true);
  const [resetProgress, setResetProgress] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Confirmation Modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Default to the very latest report whenever the modal opens or reports change
  useEffect(() => {
    if (isOpen && eligibleReports.length > 0) {
      setSelectedReportId(eligibleReports[0].id);
      setIsDropdownOpen(false);
      setDropdownSearch('');
      setIsConfirmOpen(false);
    }
  }, [isOpen, eligibleReports]);

  // Handle outside click for custom dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const targetReport = useMemo(() => {
    return eligibleReports.find((r) => r.id === selectedReportId) || eligibleReports[0] || null;
  }, [eligibleReports, selectedReportId]);

  // Filtered dropdown options by search query
  const filteredDropdownOptions = useMemo(() => {
    if (!dropdownSearch.trim()) return eligibleReports;
    const q = dropdownSearch.toLowerCase();
    return eligibleReports.filter((r) => {
      const formatted = formatDateSafe(r.date, 'dd-MMM-yyyy').toLowerCase();
      return (
        r.date.toLowerCase().includes(q) ||
        r.slot.toLowerCase().includes(q) ||
        formatted.includes(q) ||
        r.tasks.some((t) => t.category.toLowerCase().includes(q))
      );
    });
  }, [eligibleReports, dropdownSearch]);

  // Set of current existing task titles to detect duplicates
  const currentTitlesSet = useMemo(() => {
    return new Set(currentTasks.map((t) => t.category.trim().toLowerCase()));
  }, [currentTasks]);

  // Candidate tasks from the source report based on exclusion filters
  const candidateTasks = useMemo(() => {
    if (!targetReport) return [];

    return targetReport.tasks.filter((task) => {
      if (excludeCompleted) {
        const isCompStatus = metadata.statuses.find((s) => s.id === task.statusId)?.isCompletedState;
        if (task.completionPct === 100 || isCompStatus) return false;
      }
      return true;
    });
  }, [targetReport, excludeCompleted, metadata.statuses]);

  // Auto-select candidate tasks based on duplicate filter
  useEffect(() => {
    if (!targetReport) {
      setSelectedTaskIds(new Set());
      return;
    }

    const nextSelected = new Set<string>();
    candidateTasks.forEach((task) => {
      const isAlreadyInCurrent = currentTitlesSet.has(task.category.trim().toLowerCase());
      if (excludeExisting && isAlreadyInCurrent) {
        return;
      }
      nextSelected.add(task.id);
    });

    setSelectedTaskIds(nextSelected);
  }, [candidateTasks, excludeExisting, currentTitlesSet, targetReport]);

  if (!isOpen) return null;

  const handleToggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set<string>();
    candidateTasks.forEach((t) => {
      const isDuplicate = currentTitlesSet.has(t.category.trim().toLowerCase());
      if (!excludeExisting || !isDuplicate) {
        next.add(t.id);
      }
    });
    setSelectedTaskIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedTaskIds(new Set());
  };

  // Open confirmation modal
  const handleOpenConfirmation = () => {
    if (selectedTaskIds.size === 0) return;
    setIsConfirmOpen(true);
  };

  // Execute Rollover after confirmation
  const handleFinalRolloverConfirm = () => {
    if (!targetReport) return;

    const tasksToRoll = candidateTasks.filter((t) => selectedTaskIds.has(t.id));

    const newTasks: TaskRow[] = tasksToRoll.map((t, idx) => ({
      ...t,
      id: `task_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      order: (currentTasks.length || 0) + idx + 1,
      completionPct: resetProgress ? 0 : t.completionPct,
      confidencePct: resetProgress ? 0 : t.confidencePct,
      previousCompletionPct: resetProgress ? undefined : t.previousCompletionPct,
      previousConfidencePct: resetProgress ? undefined : t.previousConfidencePct,
    }));

    setIsConfirmOpen(false);
    onRollover(newTasks);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in">
        <div className="bg-white dark:bg-[#050c21] w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-[#142552] overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-slate-100">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-[#020612] border-b border-slate-200 dark:border-[#142552] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff2d5f] to-rose-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-[#ff2d5f]/25">
                <RefreshCw className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight uppercase">
                    Rollover / Roll Forward Tasks
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-[#ff2d5f]/20 text-[#ff2d5f]">
                    Smart Carry-Forward
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Transfer incomplete tasks from any previous day/slot into your current workspace.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#08122f] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {eligibleReports.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Clock className="w-10 h-10 text-slate-400 mx-auto stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No previous reports with tasks found.
                </p>
                <p className="text-xs text-slate-500">
                  Create and save at least one task report first to use the rollover tool.
                </p>
              </div>
            ) : (
              <>
                {/* 1. SOURCE & TARGET PIPELINE CARD */}
                <div className="bg-slate-50 dark:bg-[#020612] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-2xs">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    {/* FROM: Source */}
                    <div className="flex-1 w-full p-2.5 rounded-lg bg-white dark:bg-[#050c21] border border-slate-200 dark:border-[#142552]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Source (Data Taken From)
                        </span>
                        {targetReport?.slot === 'MORNING' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                            <Sun className="w-3 h-3 text-amber-500" /> Morning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                            <Moon className="w-3 h-3 text-indigo-500" /> Evening
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#ff2d5f]" />
                        <span>{targetReport ? formatDateSafe(targetReport.date, 'dd-MMM-yyyy') : 'N/A'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {targetReport?.tasks?.length || 0} tasks available in source snapshot
                      </div>
                    </div>

                    {/* Transfer Direction Indicator */}
                    <div className="flex flex-col items-center justify-center px-2 text-[#ff2d5f]">
                      <div className="hidden sm:flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-rose-50 dark:bg-[#ff2d5f]/15 px-2 py-0.5 rounded-full border border-rose-200 dark:border-[#ff2d5f]/30">
                        Roll Forward <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                      </div>
                      <div className="sm:hidden flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
                        ↓ Moving into ↓
                      </div>
                    </div>

                    {/* TO: Target */}
                    <div className="flex-1 w-full p-2.5 rounded-lg bg-white dark:bg-[#050c21] border border-rose-200 dark:border-[#ff2d5f]/30 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#ff2d5f]">
                          Destination (Target Table)
                        </span>
                        {activeSlot === 'MORNING' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                            <Sun className="w-3 h-3 text-amber-500" /> Morning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                            <Moon className="w-3 h-3 text-indigo-500" /> Evening
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-emerald-500" />
                        <span>{activeDate ? formatDateSafe(activeDate, 'dd-MMM-yyyy') : 'Current Date'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {currentTasks.length} task(s) currently in active table
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. SOURCE REPORT SELECTOR WITH PROPER SCROLLING & LATEST ON TOP */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Select Source Date &amp; Slot
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Latest record displayed at top
                    </span>
                  </div>

                  {/* Custom Dropdown Container */}
                  <div ref={dropdownRef} className="relative w-full">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs hover:border-[#ff2d5f] transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Calendar className="w-3.5 h-3.5 text-[#ff2d5f] flex-shrink-0" />
                        {targetReport ? (
                          <>
                            <span className="font-bold">{formatDateSafe(targetReport.date, 'dd-MMM-yyyy')}</span>
                            <span className="text-slate-400">•</span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-black uppercase',
                                targetReport.slot === 'MORNING'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                              )}
                            >
                              {targetReport.slot}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              ({targetReport.tasks.length} tasks)
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">Select source snapshot...</span>
                        )}
                      </div>
                      <ChevronDown
                        className={cn('w-4 h-4 text-slate-400 transition-transform', isDropdownOpen ? 'rotate-180' : '')}
                      />
                    </button>

                    {/* Dropdown Menu with Search & Custom Scrollbar */}
                    {isDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white dark:bg-[#050c21] border border-slate-200 dark:border-[#142552] rounded-xl shadow-2xl p-2 text-xs space-y-1.5 animate-in fade-in zoom-in-95">
                        {/* Dropdown Search Bar */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={dropdownSearch}
                            onChange={(e) => setDropdownSearch(e.target.value)}
                            placeholder="Search by date (e.g. 18-Nov) or slot..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-lg text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#ff2d5f]"
                          />
                        </div>

                        {/* Dropdown Scrollable List (Explicit max-h-60 with visible scrollbar) */}
                        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border-t border-slate-100 dark:border-[#142552] pt-1.5">
                          {filteredDropdownOptions.length === 0 ? (
                            <div className="py-4 text-center text-xs text-slate-400">
                              No matching report snapshots found.
                            </div>
                          ) : (
                            filteredDropdownOptions.map((rep, idx) => {
                              const isSelected = rep.id === selectedReportId;
                              const isLatest = idx === 0 && !dropdownSearch;

                              return (
                                <button
                                  key={rep.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedReportId(rep.id);
                                    setIsDropdownOpen(false);
                                  }}
                                  className={cn(
                                    'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer text-left',
                                    isSelected
                                      ? 'bg-rose-50 dark:bg-[#ff2d5f]/15 border border-rose-200 dark:border-[#ff2d5f]/30 text-rose-950 dark:text-rose-200'
                                      : 'hover:bg-slate-100 dark:hover:bg-[#08122f] text-slate-800 dark:text-slate-200 border border-transparent'
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold font-mono">
                                      {formatDateSafe(rep.date, 'dd-MMM-yyyy')}
                                    </span>
                                    <span
                                      className={cn(
                                        'px-1.5 py-0.2 rounded text-[10px] font-black uppercase flex items-center gap-1',
                                        rep.slot === 'MORNING'
                                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                          : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                                      )}
                                    >
                                      {rep.slot === 'MORNING' ? <Sun className="w-2.5 h-2.5" /> : <Moon className="w-2.5 h-2.5" />}
                                      {rep.slot}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      ({rep.tasks.length} tasks)
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {isLatest && (
                                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 dark:bg-[#ff2d5f]/25 text-[#ff2d5f]">
                                        Latest
                                      </span>
                                    )}
                                    {isSelected && <Check className="w-4 h-4 text-[#ff2d5f] stroke-[2.5]" />}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. FILTER CHECKBOXES */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {/* Exclude Completed */}
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-[#020612] rounded-xl border border-slate-200 dark:border-[#142552] cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#08122f] transition-colors">
                    <input
                      type="checkbox"
                      checked={excludeCompleted}
                      onChange={(e) => setExcludeCompleted(e.target.checked)}
                      className="w-4 h-4 text-[#ff2d5f] rounded border-slate-300 dark:border-slate-700 focus:ring-[#ff2d5f]"
                    />
                    <span>Exclude 100% Completed</span>
                  </label>

                  {/* Exclude Existing Duplicates */}
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-[#020612] rounded-xl border border-slate-200 dark:border-[#142552] cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#08122f] transition-colors">
                    <input
                      type="checkbox"
                      checked={excludeExisting}
                      onChange={(e) => setExcludeExisting(e.target.checked)}
                      className="w-4 h-4 text-[#ff2d5f] rounded border-slate-300 dark:border-slate-700 focus:ring-[#ff2d5f]"
                    />
                    <span>Skip Already Added</span>
                  </label>

                  {/* Reset Progress to 0% */}
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-[#020612] rounded-xl border border-slate-200 dark:border-[#142552] cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#08122f] transition-colors">
                    <input
                      type="checkbox"
                      checked={resetProgress}
                      onChange={(e) => setResetProgress(e.target.checked)}
                      className="w-4 h-4 text-[#ff2d5f] rounded border-slate-300 dark:border-slate-700 focus:ring-[#ff2d5f]"
                    />
                    <span>Reset Progress to 0%</span>
                  </label>
                </div>

                {/* 4. TASK CHECKLIST */}
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#142552]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Candidate Tasks to Roll Forward
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-[#ff2d5f]/15 text-[#ff2d5f]">
                        {selectedTaskIds.size} of {candidateTasks.length} selected
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[#ff2d5f] hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Task List with Visible Scrollbar */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-[#142552]/40 mt-1 pr-1">
                    {candidateTasks.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500 font-medium">
                        No matching tasks found under the current filter criteria.
                      </div>
                    ) : (
                      candidateTasks.map((task) => {
                        const isSelected = selectedTaskIds.has(task.id);
                        const isDuplicate = currentTitlesSet.has(task.category.trim().toLowerCase());
                        const statusObj = metadata.statuses.find((s) => s.id === task.statusId);
                        const sectionObj = metadata.sections.find((s) => s.id === task.sectionId);
                        const ownerNames = task.ownerIds
                          .map((id) => metadata.owners.find((o) => o.id === id)?.name)
                          .filter(Boolean)
                          .join(', ');

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleToggleTask(task.id)}
                            className={cn(
                              'p-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors text-xs select-none my-1',
                              isSelected
                                ? 'bg-rose-50/70 dark:bg-[#ff2d5f]/10 border border-rose-200 dark:border-[#ff2d5f]/25'
                                : 'bg-white dark:bg-[#020612] hover:bg-slate-50 dark:hover:bg-[#08122f] border border-transparent'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="flex-shrink-0 text-[#ff2d5f]">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 fill-[#ff2d5f] text-white" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {sectionObj && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#08122f] px-1.5 py-0.2 rounded border border-slate-200 dark:border-[#142552]">
                                      {sectionObj.title}
                                    </span>
                                  )}

                                  <span className="font-bold text-slate-900 dark:text-white truncate">
                                    {task.category}
                                  </span>

                                  {isDuplicate && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/40">
                                      Already in current report
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {ownerNames && (
                                    <span>
                                      Owner: <strong>{ownerNames}</strong>
                                    </span>
                                  )}
                                  {task.etaDate && (
                                    <span className="flex items-center gap-1 font-mono">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      ETA: {task.etaDate}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {statusObj && (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap"
                                  style={{
                                    backgroundColor: statusObj.bgColor,
                                    color: statusObj.textColor || '#0F172A',
                                  }}
                                >
                                  {statusObj.label}
                                </span>
                              )}

                              <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 w-10 text-right">
                                {task.completionPct}%
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sticky Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-[#020612] border-t border-slate-200 dark:border-[#142552] flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Target Destination: <strong>{activeDate} ({activeSlot})</strong>
            </span>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#08122f] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOpenConfirmation}
                disabled={selectedTaskIds.size === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#ff2d5f] hover:bg-[#e62252] disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md shadow-[#ff2d5f]/25 hover:shadow-[0_0_16px_rgba(255,45,95,0.45)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Roll Forward ({selectedTaskIds.size}) Tasks</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL BEFORE APPLYING ROLLOVER */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        title={`Confirm Roll Forward (${selectedTaskIds.size} Tasks)?`}
        description={`You are about to carry forward ${selectedTaskIds.size} tasks from ${targetReport ? formatDateSafe(targetReport.date, 'dd-MMM-yyyy') : ''} (${targetReport?.slot}) into your ${activeDate} (${activeSlot}) table. ${
          excludeExisting ? 'Duplicate task titles will be skipped.' : ''
        } ${resetProgress ? 'Task completion will be reset to 0%.' : 'Existing progress will be retained.'} Proceed?`}
        confirmLabel={`Yes, Roll Forward ${selectedTaskIds.size} Tasks`}
        cancelLabel="Back to Selection"
        variant="cyan"
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleFinalRolloverConfirm}
      />
    </>
  );
};
