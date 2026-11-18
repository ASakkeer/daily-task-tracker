import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, Check, Layers, CheckSquare, Square, Calendar, ShieldCheck, Clock } from 'lucide-react';
import { AppMetadata, ReportSnapshot, TaskRow } from '../../types';
import { formatDateSafe } from '../../utils/date';
import { CustomDropdown } from '../common/CustomDropdown';
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
  // Filter available reports to those with actual tasks
  const eligibleReports = useMemo(() => {
    return availableReports.filter((r) => r.tasks && r.tasks.length > 0);
  }, [availableReports]);

  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [excludeCompleted, setExcludeCompleted] = useState(true);
  const [excludeExisting, setExcludeExisting] = useState(true);
  const [resetProgress, setResetProgress] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Default to the first report whenever the modal opens or reports change
  useEffect(() => {
    if (isOpen && eligibleReports.length > 0) {
      const defaultId = eligibleReports[0].id;
      setSelectedReportId(defaultId);
    }
  }, [isOpen, eligibleReports]);

  const targetReport = useMemo(() => {
    return eligibleReports.find((r) => r.id === selectedReportId) || eligibleReports[0] || null;
  }, [eligibleReports, selectedReportId]);

  // Set of current existing task titles (lowercase trimmed) to detect duplicates
  const currentTitlesSet = useMemo(() => {
    return new Set(currentTasks.map((t) => t.category.trim().toLowerCase()));
  }, [currentTasks]);

  // Candidate tasks from the target report based on exclusion filters
  const candidateTasks = useMemo(() => {
    if (!targetReport) return [];

    return targetReport.tasks.filter((task) => {
      // Exclude completed filter
      if (excludeCompleted) {
        const isCompStatus = metadata.statuses.find((s) => s.id === task.statusId)?.isCompletedState;
        if (task.completionPct === 100 || isCompStatus) return false;
      }
      return true;
    });
  }, [targetReport, excludeCompleted, metadata.statuses]);

  // Update selected IDs whenever candidate tasks or exclusion filters change
  useEffect(() => {
    if (!targetReport) {
      setSelectedTaskIds(new Set());
      return;
    }

    const nextSelected = new Set<string>();
    candidateTasks.forEach((task) => {
      const isAlreadyInCurrent = currentTitlesSet.has(task.category.trim().toLowerCase());
      if (excludeExisting && isAlreadyInCurrent) {
        // Skip duplicate
        return;
      }
      nextSelected.add(task.id);
    });

    setSelectedTaskIds(nextSelected);
  }, [candidateTasks, excludeExisting, currentTitlesSet]);

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

  const handleConfirm = () => {
    if (!targetReport) return;

    // Filter to selected tasks
    const tasksToRoll = candidateTasks.filter((t) => selectedTaskIds.has(t.id));

    // Generate fresh ids and updated state for rolled-over tasks
    const newTasks: TaskRow[] = tasksToRoll.map((t, idx) => ({
      ...t,
      id: `task_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      order: (currentTasks.length || 0) + idx + 1,
      completionPct: resetProgress ? 0 : t.completionPct,
      confidencePct: resetProgress ? 0 : t.confidencePct,
      previousCompletionPct: resetProgress ? undefined : t.previousCompletionPct,
      previousConfidencePct: resetProgress ? undefined : t.previousConfidencePct,
    }));

    onRollover(newTasks);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-[#050c21] w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-[#142552] overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#020612] border-b border-slate-200 dark:border-[#142552] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ff2d5f] text-white flex items-center justify-center font-bold text-sm shadow-md shadow-[#ff2d5f]/25">
              <RefreshCw className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Rollover / Roll Forward Tasks
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Carry forward pending tasks from a previous day into today&apos;s <strong>{activeSlot}</strong> snapshot
              </span>
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
            <div className="text-center py-10 space-y-2">
              <Clock className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No previous reports found to roll over from.
              </p>
              <p className="text-xs text-slate-500">
                Create and save a report with tasks first to use the rollover tool.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Source Report Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                  Select Source Report Snapshot
                </label>
                <CustomDropdown
                  value={selectedReportId}
                  onChange={setSelectedReportId}
                  options={eligibleReports.map((rep) => ({
                    value: rep.id,
                    label: `${formatDateSafe(rep.date, 'dd-MMM-yyyy')} — ${rep.slot} (${rep.tasks.length} tasks)`,
                  }))}
                  className="w-full text-xs"
                  buttonClassName="py-2 px-3 text-xs font-bold"
                />
              </div>

              {/* 2. Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
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

              {/* 3. Task Checklist Header */}
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

                {/* Task List */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-[#142552]/40 mt-1">
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
                                {ownerNames && <span>Owner: <strong>{ownerNames}</strong></span>}
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
            Target Slot: <strong>{activeSlot}</strong>
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
              onClick={handleConfirm}
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
  );
};
