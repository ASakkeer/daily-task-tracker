import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, Calendar as CalendarIcon, Clock, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppMetadata, BacklogItem, ReportSlot, TaskRow, ReportSnapshot } from '../../types';
import { db, logActivity } from '../../db';
import { getTodayDateStr } from '../../utils/date';
import { DatePickerPopover } from '../common/DatePickerPopover';
import { cn } from '../../utils/cn';

interface BacklogPushToTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BacklogItem | null;
  metadata: AppMetadata;
  onSuccess: (details: string) => void;
}

export const BacklogPushToTaskModal: React.FC<BacklogPushToTaskModalProps> = ({
  isOpen,
  onClose,
  item,
  metadata,
  onSuccess,
}) => {
  const [targetDate, setTargetDate] = useState<string>(getTodayDateStr());
  const [targetSlot, setTargetSlot] = useState<ReportSlot>('MORNING');
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [targetStatusId, setTargetStatusId] = useState<string>('');
  const [updateBacklogStatus, setUpdateBacklogStatus] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetDate(getTodayDateStr());
      setTargetSlot('MORNING');
      setTargetSectionId(metadata.sections?.[0]?.id || '');
      setTargetStatusId(metadata.statuses?.[0]?.id || '');
      setUpdateBacklogStatus(true);
      setError(null);
    }
  }, [isOpen, metadata]);

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    if (!targetSectionId && metadata.sections.length > 0) {
      setError('Please select a target report section.');
      return;
    }

    try {
      setIsSubmitting(true);
      const snapshotId = `${targetDate}_${targetSlot}`;
      let snapshot = await db.reports.get(snapshotId);

      const newTaskOrder = snapshot?.tasks ? snapshot.tasks.length + 1 : 1;

      const newTask: TaskRow = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sectionId: targetSectionId || (metadata.sections?.[0]?.id ?? 'default_sec'),
        order: newTaskOrder,
        category: item.title,
        completionPct: 0,
        confidencePct: 100,
        ownerIds: item.ownerIds || [],
        customOwnerText: item.customOwnerText || '',
        etaDate: targetDate,
        statusId: targetStatusId || (metadata.statuses?.[0]?.id ?? 'status_wip'),
        notes: item.notes || (item.moduleEpic ? `Epic: ${item.moduleEpic}` : ''),
        highlightNotesBold: false,
      };

      if (!snapshot) {
        snapshot = {
          id: snapshotId,
          date: targetDate,
          slot: targetSlot,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tasks: [newTask],
        };
        await db.reports.put(snapshot);
      } else {
        snapshot.tasks = [...snapshot.tasks, newTask];
        snapshot.updatedAt = new Date().toISOString();
        await db.reports.put(snapshot);
      }

      // Optionally update backlog item status to in_progress
      if (updateBacklogStatus && item.status !== 'in_progress') {
        await db.backlogItems.update(item.id, {
          status: 'in_progress',
          updatedAt: new Date().toISOString(),
        });
      }

      const currentActor = metadata.owners?.[0]?.name || 'Admin';
      const currentActorRole = metadata.owners?.[0]?.role || 'Team Lead';

      await logActivity({
        actionType: 'backlog_to_task',
        actionLabel: 'Pushed to Daily Tasks',
        entityType: 'backlog',
        entityId: item.id,
        entityTitle: item.title,
        actor: currentActor,
        actorRole: currentActorRole,
        details: `Dispatched backlog work item "${item.title}" into ${targetDate} (${targetSlot}) report table.`,
        severity: 'success',
      });

      onSuccess(`Item "${item.title}" pushed to ${targetDate} (${targetSlot}) report!`);
      onClose();
    } catch (err: any) {
      setError(`Failed to push to daily tasks: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] shadow-2xl flex flex-col overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#142552] bg-slate-50/50 dark:bg-[#020612]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 border border-amber-200 dark:border-amber-500/20">
              <Zap className="w-4 h-4 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Push to Daily Task Table
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Dispatch this backlog item directly into an active daily standup table
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-[#08122f] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handlePush} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-[#ff2d5f]/10 border border-rose-200 dark:border-[#ff2d5f]/30 flex items-center gap-2 text-xs text-rose-700 dark:text-[#ff2d5f] font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Item Preview */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#08122f] border border-slate-200 dark:border-[#142552]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Work Item to Push
            </span>
            <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
              {item.title}
            </p>
            {item.moduleEpic && (
              <span className="inline-block mt-1 text-[10px] font-semibold text-blue-500">
                Module: {item.moduleEpic}
              </span>
            )}
          </div>

          {/* Date & Slot Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
                Target Date
              </label>
              <DatePickerPopover value={targetDate} onChange={(newDate) => setTargetDate(newDate)} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Report Slot
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['MORNING', 'EVENING'] as ReportSlot[]).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTargetSlot(slot)}
                    className={cn(
                      'py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer',
                      targetSlot === slot
                        ? 'bg-[#ff2d5f] text-white border-[#ff2d5f] shadow-sm'
                        : 'bg-slate-50 dark:bg-[#020612] border-slate-300 dark:border-[#142552] text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section & Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Target Section
              </label>
              <select
                value={targetSectionId}
                onChange={(e) => setTargetSectionId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white"
                required
              >
                {metadata.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                Initial Task Status
              </label>
              <select
                value={targetStatusId}
                onChange={(e) => setTargetStatusId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white"
              >
                {metadata.statuses.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkbox: Mark Backlog Item in Progress */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={updateBacklogStatus}
                onChange={(e) => setUpdateBacklogStatus(e.target.checked)}
                className="rounded text-[#ff2d5f] focus:ring-[#ff2d5f] w-4 h-4"
              />
              <span>Automatically update backlog item status to &ldquo;In Progress&rdquo;</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-[#142552]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#08122f] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-black text-white bg-[#ff2d5f] hover:bg-[#e02653] shadow-md shadow-[#ff2d5f]/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>{isSubmitting ? 'Pushing...' : 'Push to Table'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
