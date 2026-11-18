import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toPng } from 'html-to-image';
import {
  Download,
  Plus,
  Copy,
  RefreshCw,
  CheckCircle,
  FileSpreadsheet,
  Send,
  ChevronDown,
  Upload,
  FileJson,
  Sparkles,
} from 'lucide-react';
import {
  AppMetadata,
  ReportSnapshot,
  ReportSlot,
  TaskRow,
  SectionItem,
  TableDensity,
} from '../../types';
import {
  db,
  logActivity,
  exportReportBuilderTasksToJson,
  importReportBuilderTasksFromJson,
} from '../../db';
import { DatePickerPopover } from '../common/DatePickerPopover';
import { SpreadsheetTable } from './SpreadsheetTable';
import { ReportExportCanvas } from './ReportExportCanvas';
import { TableToolbar } from './TableToolbar';
import { TaskModal } from '../modals/TaskModal';
import { RolloverModal } from '../modals/RolloverModal';
import { ConfirmationModal, ConfirmationVariant } from '../common/ConfirmationModal';
import { formatReportTitle, getTodayDateStr } from '../../utils/date';
import { getCleanWorkspaceSubtitle } from '../../utils/branding';
import { calculateDaysOverdue } from '../../utils/aging';
import { cn } from '../../utils/cn';
import { exportTableAsCsv, generateDailyStandup, dispatchEodWebhook } from '../../services/aiService';

interface ReportBuilderViewProps {
  metadata: AppMetadata;
  onMetadataUpdated: () => void;
  initialDate?: string;
  initialSlot?: ReportSlot;
  onContextChange?: (date: string, slot: ReportSlot) => void;
}

const LAST_SLOT_STORAGE_KEY = 'daily_task_tracker_last_slot';
const LAST_DATE_STORAGE_KEY = 'daily_task_tracker_last_date';

const SLOTS: ReportSlot[] = ['MORNING', 'EVENING'];

export const ReportBuilderView: React.FC<ReportBuilderViewProps> = ({
  metadata,
  onMetadataUpdated,
  initialDate,
  initialSlot,
  onContextChange,
}) => {
  const [activeDate, setActiveDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const saved = localStorage.getItem(LAST_DATE_STORAGE_KEY);
    return saved || getTodayDateStr();
  });

  const [activeSlot, setActiveSlot] = useState<ReportSlot>(() => {
    if (initialSlot) return initialSlot;
    const saved = localStorage.getItem(LAST_SLOT_STORAGE_KEY);
    if (saved === 'MORNING' || saved === 'EVENING' || saved === 'AFTERNOON') {
      return saved as ReportSlot;
    }
    return 'MORNING';
  });
  const [highlightEodChanges, setHighlightEodChanges] = useState<boolean>(true);

  // In-table search, filter and density state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwnerFilters, setSelectedOwnerFilters] = useState<string[]>([]);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [density, setDensity] = useState<TableDensity>('compact');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const [currentSnapshot, setCurrentSnapshot] = useState<ReportSnapshot | null>(null);
  const [previousSlotSnapshot, setPreviousSlotSnapshot] = useState<ReportSnapshot | null>(null);
  const [allRecentReports, setAllRecentReports] = useState<ReportSnapshot[]>([]);

  // Modals & Export Hub state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
  const [isExportHubOpen, setIsExportHubOpen] = useState(false);
  const [copiedSlack, setCopiedSlack] = useState(false);
  const [dispatchingWebhook, setDispatchingWebhook] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reusable Confirmation & Notice Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmationVariant;
    isAlertOnly?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Dedicated unconstrained export canvas ref
  const exportCanvasRef = useRef<HTMLDivElement>(null);

  const currentActor = metadata.owners?.[0]?.name || 'Admin';
  const currentActorRole = metadata.owners?.[0]?.role || 'Team Lead';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const showNotice = (title: string, message: string, variant: ConfirmationVariant = 'info') => {
    setConfirmDialog({
      isOpen: true,
      title,
      description: message,
      confirmLabel: 'Dismiss',
      isAlertOnly: true,
      variant,
      onConfirm: () => {},
    });
  };

  // Keyboard shortcuts (N: new task, E: export)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingTask(null);
        setIsTaskModalOpen(true);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handleExportPng();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSnapshot, activeDate, activeSlot]);

  // Synchronize when initial props change externally (e.g. navigated from Calendar or Command Palette)
  useEffect(() => {
    if (initialSlot && initialSlot !== activeSlot) {
      setActiveSlot(initialSlot);
      localStorage.setItem(LAST_SLOT_STORAGE_KEY, initialSlot);
    }
  }, [initialSlot, activeSlot]);

  useEffect(() => {
    if (initialDate && initialDate !== activeDate) {
      setActiveDate(initialDate);
      localStorage.setItem(LAST_DATE_STORAGE_KEY, initialDate);
    }
  }, [initialDate, activeDate]);

  // Load active report snapshot from Dexie
  const loadActiveReport = async () => {
    const reportId = `${activeDate}_${activeSlot}`;
    const found = await db.reports.get(reportId);

    // Also look up morning slot of same date for diff tracking
    let prevSlot: ReportSnapshot | null = null;
    if (activeSlot !== 'MORNING') {
      const morningId = `${activeDate}_MORNING`;
      prevSlot = (await db.reports.get(morningId)) || null;
    }
    setPreviousSlotSnapshot(prevSlot);

    // Fetch all reports for rollover selection, sorted latest date & slot first
    const all = await db.reports.toArray();
    const sorted = all.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      const slotRank: Record<string, number> = { EVENING: 3, AFTERNOON: 2, MORNING: 1 };
      return (slotRank[b.slot] || 0) - (slotRank[a.slot] || 0);
    });
    setAllRecentReports(sorted);

    if (found) {
      setCurrentSnapshot(found);
    } else {
      // If no report exists yet for this date + slot, initialize a fresh empty draft
      const newDraft: ReportSnapshot = {
        id: reportId,
        date: activeDate,
        slot: activeSlot,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
      };
      await db.reports.put(newDraft);
      setCurrentSnapshot(newDraft);
    }
    setSelectedTaskIds([]);
  };

  useEffect(() => {
    loadActiveReport();
  }, [activeDate, activeSlot]);

  // Batch Selection Handlers
  const handleToggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllTasks = (taskIds: string[]) => {
    setSelectedTaskIds(taskIds);
  };

  const handleBatchUpdateTasks = async (taskIds: string[], updates: Partial<TaskRow>) => {
    if (!currentSnapshot) return;
    const updated = currentSnapshot.tasks.map((t) =>
      taskIds.includes(t.id) ? { ...t, ...updates } : t
    );
    await persistTasks(updated);
    showToast(`Batch updated ${taskIds.length} tasks!`);
    setSelectedTaskIds([]);
  };

  const handleBatchDeleteTasks = async (taskIds: string[]) => {
    if (!currentSnapshot) return;
    const updated = currentSnapshot.tasks.filter((t) => !taskIds.includes(t.id));
    await persistTasks(updated);
    showToast(`Deleted ${taskIds.length} tasks from current report.`);
    setSelectedTaskIds([]);

    logActivity({
      actionType: 'batch_delete',
      actionLabel: 'Batch Tasks Deleted',
      entityType: 'task',
      entityId: 'batch_delete',
      entityTitle: `${taskIds.length} Selected Tasks`,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Batch deleted ${taskIds.length} tasks from ${activeSlot} report snapshot`,
      severity: 'danger',
    });
  };

  // Persist snapshot updates to Dexie
  const persistTasks = async (updatedTasks: TaskRow[]) => {
    if (!currentSnapshot) return;
    const updated: ReportSnapshot = {
      ...currentSnapshot,
      tasks: updatedTasks,
      updatedAt: new Date().toISOString(),
    };
    setCurrentSnapshot(updated);
    await db.reports.put(updated);
  };

  // Reorder tasks
  const handleTasksReorder = async (reorderedTasks: TaskRow[]) => {
    await persistTasks(reorderedTasks);
    logActivity({
      actionType: 'task_reorder',
      actionLabel: 'Tasks Reordered',
      entityType: 'report',
      entityId: `${activeDate}_${activeSlot}`,
      entityTitle: `${activeSlot} Task Table (${activeDate})`,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Reordered priority sequence of tasks within section in ${activeSlot} snapshot`,
      severity: 'info',
    });
  };

  // Quick Inline updates
  const handleQuickUpdateTask = async (taskId: string, updates: Partial<TaskRow>) => {
    if (!currentSnapshot) return;
    const prevTask = currentSnapshot.tasks.find((t) => t.id === taskId);
    const updated = currentSnapshot.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
    await persistTasks(updated);

    // Audit Log for status change
    if (updates.statusId && prevTask && updates.statusId !== prevTask.statusId) {
      const prevStatusLabel = metadata.statuses.find((s) => s.id === prevTask.statusId)?.label || prevTask.statusId;
      const newStatusLabel = metadata.statuses.find((s) => s.id === updates.statusId)?.label || updates.statusId;
      const isCompleted = metadata.statuses.find((s) => s.id === updates.statusId)?.isCompletedState;
      logActivity({
        actionType: 'status_change',
        actionLabel: 'Status Transition',
        entityType: 'task',
        entityId: taskId,
        entityTitle: prevTask.category,
        actor: currentActor,
        actorRole: currentActorRole,
        sectionName: metadata.sections.find((s) => s.id === prevTask.sectionId)?.title,
        details: `Status transitioned: ${prevStatusLabel} → ${newStatusLabel}`,
        changes: [{ field: 'status', fieldLabel: 'Status', from: prevStatusLabel, to: newStatusLabel }],
        severity: isCompleted ? 'success' : 'info',
      });
    }

    // Audit Log for completion change
    if (updates.completionPct !== undefined && prevTask && updates.completionPct !== prevTask.completionPct) {
      logActivity({
        actionType: 'completion_update',
        actionLabel: 'Progress Velocity Updated',
        entityType: 'task',
        entityId: taskId,
        entityTitle: prevTask.category,
        actor: currentActor,
        actorRole: currentActorRole,
        sectionName: metadata.sections.find((s) => s.id === prevTask.sectionId)?.title,
        details: `Completion shifted from ${prevTask.completionPct}% to ${updates.completionPct}%`,
        changes: [{ field: 'completionPct', fieldLabel: 'Completion %', from: prevTask.completionPct, to: updates.completionPct }],
        severity: updates.completionPct === 100 ? 'success' : 'info',
      });
    }

    // Audit Log for confidence score change
    if (updates.confidencePct !== undefined && prevTask && updates.confidencePct !== prevTask.confidencePct) {
      logActivity({
        actionType: 'task_update',
        actionLabel: 'Confidence Score Updated',
        entityType: 'task',
        entityId: taskId,
        entityTitle: prevTask.category,
        actor: currentActor,
        actorRole: currentActorRole,
        sectionName: metadata.sections.find((s) => s.id === prevTask.sectionId)?.title,
        details: `Confidence shifted from ${prevTask.confidencePct}% to ${updates.confidencePct}%`,
        changes: [{ field: 'confidencePct', fieldLabel: 'Confidence %', from: prevTask.confidencePct, to: updates.confidencePct }],
        severity: 'info',
      });
    }

    // Audit Log for notes change
    if (updates.notes !== undefined && prevTask && updates.notes !== prevTask.notes) {
      logActivity({
        actionType: 'task_update',
        actionLabel: 'Notes / Blockers Updated',
        entityType: 'task',
        entityId: taskId,
        entityTitle: prevTask.category,
        actor: currentActor,
        actorRole: currentActorRole,
        sectionName: metadata.sections.find((s) => s.id === prevTask.sectionId)?.title,
        details: `Updated notes: ${updates.notes ? updates.notes.slice(0, 80) : '(Cleared)'}`,
        changes: [{ field: 'notes', fieldLabel: 'Notes', from: prevTask.notes, to: updates.notes }],
        severity: 'info',
      });
    }

    // Audit Log for owner change
    if (updates.ownerIds && prevTask && JSON.stringify(updates.ownerIds) !== JSON.stringify(prevTask.ownerIds)) {
      const prevOwnerNames = prevTask.ownerIds.map((id) => metadata.owners.find((o) => o.id === id)?.name).filter(Boolean).join(', ') || 'Unassigned';
      const newOwnerNames = updates.ownerIds.map((id) => metadata.owners.find((o) => o.id === id)?.name).filter(Boolean).join(', ') || 'Unassigned';
      logActivity({
        actionType: 'task_update',
        actionLabel: 'Task Owner Changed',
        entityType: 'task',
        entityId: taskId,
        entityTitle: prevTask.category,
        actor: currentActor,
        actorRole: currentActorRole,
        sectionName: metadata.sections.find((s) => s.id === prevTask.sectionId)?.title,
        details: `Owner updated: ${prevOwnerNames} → ${newOwnerNames}`,
        changes: [{ field: 'owner', fieldLabel: 'Owner', from: prevOwnerNames, to: newOwnerNames }],
        severity: 'info',
      });
    }

    // Audit Log for ETA change
    if (updates.etaDate && prevTask && updates.etaDate !== prevTask.etaDate) {
      logActivity({
        actionType: 'task_update',
        actionLabel: 'ETA Date Changed',
        entityType: 'task',
        entityId: taskId,
        entityTitle: prevTask.category,
        actor: currentActor,
        actorRole: currentActorRole,
        sectionName: metadata.sections.find((s) => s.id === prevTask.sectionId)?.title,
        details: `ETA shifted from ${prevTask.etaDate} to ${updates.etaDate}`,
        changes: [{ field: 'etaDate', fieldLabel: 'ETA', from: prevTask.etaDate, to: updates.etaDate }],
        severity: 'info',
      });
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!currentSnapshot) return;
    const prevTask = currentSnapshot.tasks.find((t) => t.id === taskId);
    const updated = currentSnapshot.tasks.filter((t) => t.id !== taskId);
    await persistTasks(updated);
    showToast('Task removed from current report');

    if (prevTask) {
      logActivity({
        actionType: 'task_delete',
        actionLabel: 'Task Deleted',
        entityType: 'task',
        entityId: taskId,
        entityTitle: prevTask.category,
        actor: currentActor,
        actorRole: currentActorRole,
        sectionName: metadata.sections.find((s) => s.id === prevTask.sectionId)?.title,
        details: `Deleted task "${prevTask.category}" from ${activeSlot} snapshot`,
        severity: 'danger',
      });
    }
  };

  // Save task from modal
  const handleSaveTaskFromModal = async (savedTask: TaskRow, newSectionTitle?: string) => {
    if (!currentSnapshot) return;

    if (newSectionTitle) {
      const newSection: SectionItem = {
        id: savedTask.sectionId,
        title: newSectionTitle,
        order: metadata.sections.length + 1,
        isBugSection: newSectionTitle.toLowerCase().includes('bug'),
      };
      const updatedMeta: AppMetadata = {
        ...metadata,
        sections: [...metadata.sections, newSection],
      };
      await db.metadata.put(updatedMeta);
      onMetadataUpdated();
    }

    const exists = currentSnapshot.tasks.some((t) => t.id === savedTask.id);
    let updatedTasks: TaskRow[];

    if (exists) {
      updatedTasks = currentSnapshot.tasks.map((t) => (t.id === savedTask.id ? savedTask : t));
      showToast('Task updated successfully');
      logActivity({
        actionType: 'task_update',
        actionLabel: 'Task Details Updated',
        entityType: 'task',
        entityId: savedTask.id,
        entityTitle: savedTask.category,
        actor: currentActor,
        actorRole: currentActorRole,
        sectionName: metadata.sections.find((s) => s.id === savedTask.sectionId)?.title,
        details: `Updated task details in ${activeSlot} report snapshot`,
        severity: 'info',
      });
    } else {
      updatedTasks = [...currentSnapshot.tasks, savedTask];
      showToast('New task added to report');
      logActivity({
        actionType: 'task_create',
        actionLabel: 'Task Created',
        entityType: 'task',
        entityId: savedTask.id,
        entityTitle: savedTask.category,
        actor: currentActor,
        actorRole: currentActorRole,
        sectionName: metadata.sections.find((s) => s.id === savedTask.sectionId)?.title,
        details: `Created new task in ${activeSlot} report snapshot`,
        severity: 'success',
      });
    }

    await persistTasks(updatedTasks);
  };

  const handleCopySlack = async () => {
    if (!currentSnapshot) return;
    const standup = generateDailyStandup({
      ...currentSnapshot,
      tasks: filteredTasks,
    }, metadata);
    try {
      await navigator.clipboard.writeText(standup.markdown);
      setCopiedSlack(true);
      setTimeout(() => setCopiedSlack(false), 2000);
      showToast('Slack standup markdown copied to clipboard!');
      logActivity({
        actionType: 'export',
        actionLabel: 'Standup Digest Copied',
        entityType: 'export',
        entityId: currentSnapshot.id,
        entityTitle: `Daily Standup (${activeDate} ${activeSlot})`,
        actor: currentActor,
        actorRole: currentActorRole,
        details: `Copied daily standup markdown digest to clipboard`,
        severity: 'info',
      });
    } catch {
      showNotice('Standup Copied', 'Standup markdown copied to your clipboard!');
    }
    setIsExportHubOpen(false);
  };

  const handleExportCsv = () => {
    if (!currentSnapshot) return;
    exportTableAsCsv({
      ...currentSnapshot,
      tasks: filteredTasks,
    }, metadata);
    setIsExportHubOpen(false);
    showToast('Table exported as CSV!');
    logActivity({
      actionType: 'export',
      actionLabel: 'Table Exported as CSV',
      entityType: 'export',
      entityId: currentSnapshot.id,
      entityTitle: `Table CSV (${activeDate} ${activeSlot})`,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Exported ${filteredTasks.length} tasks as CSV`,
      severity: 'info',
    });
  };

  const tasksJsonInputRef = useRef<HTMLInputElement>(null);

  const handleBackupTasksJson = async () => {
    try {
      const json = await exportReportBuilderTasksToJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Daily-Task-Tracker-Report-Builder-Tasks-${activeDate}-${activeSlot}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsExportHubOpen(false);
      showToast('Downloaded Report Builder tasks JSON backup!');
    } catch (err: any) {
      showNotice('Backup Failed', `Failed to export tasks: ${err.message}`, 'danger');
    }
  };

  const handleTasksJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      let reportsList = [];
      if (Array.isArray(parsed.reports)) {
        reportsList = parsed.reports;
      } else if (Array.isArray(parsed)) {
        reportsList = parsed;
      } else if (parsed.id && parsed.date && parsed.slot && Array.isArray(parsed.tasks)) {
        reportsList = [parsed];
      } else {
        showNotice('Invalid Tasks File', 'Selected file does not contain valid Report Builder tasks or snapshots.', 'danger');
        e.target.value = '';
        return;
      }

      const count = reportsList.reduce((acc: number, r: any) => acc + (r.tasks?.length || 0), 0);

      setConfirmDialog({
        isOpen: true,
        title: 'Restore Report Builder Tasks?',
        description: `Restore tasks from "${file.name}" (${reportsList.length} snapshots, ${count} tasks)? This will replace active report snapshot tasks with the imported dataset. Studio Customization settings will remain intact.`,
        confirmLabel: 'Restore Tasks',
        isAlertOnly: false,
        variant: 'warning',
        onConfirm: async () => {
          const res = await importReportBuilderTasksFromJson(content);
          if (res.success) {
            showToast(`Tasks restored successfully (${res.summary})!`);
            const fresh = await db.reports.where({ date: activeDate, slot: activeSlot }).first();
            if (fresh) {
              setCurrentSnapshot(fresh);
            } else {
              const allSnapshots = await db.reports.toArray();
              if (allSnapshots.length > 0) {
                const targetDate = allSnapshots[0].date;
                const targetSlot = allSnapshots[0].slot;
                setActiveDate(targetDate);
                setActiveSlot(targetSlot);
                localStorage.setItem(LAST_DATE_STORAGE_KEY, targetDate);
                localStorage.setItem(LAST_SLOT_STORAGE_KEY, targetSlot);
                onContextChange?.(targetDate, targetSlot);
              }
            }
          } else {
            showNotice('Restore Failed', res.error || 'Failed to restore tasks', 'danger');
          }
        },
      });
    } catch (err: any) {
      showNotice('Invalid JSON File', `Could not parse file: ${err.message}`, 'danger');
    } finally {
      e.target.value = '';
    }
  };

  const handleDispatchWebhook = async () => {
    if (!currentSnapshot) return;
    if (!metadata.eodDigest?.webhookUrl) {
      showNotice(
        'Missing Webhook URL',
        'No incoming webhook configured. Please set an incoming webhook URL in Metadata Settings > EOD Webhook Digest tab.',
        'warning'
      );
      return;
    }
    setDispatchingWebhook(true);
    const res = await dispatchEodWebhook({
      ...currentSnapshot,
      tasks: filteredTasks,
    }, metadata);
    setDispatchingWebhook(false);
    setIsExportHubOpen(false);

    showNotice(
      res.success ? 'Webhook Dispatched' : 'Dispatch Failed',
      res.message,
      res.success ? 'info' : 'danger'
    );

    logActivity({
      actionType: 'export',
      actionLabel: 'EOD Webhook Dispatched',
      entityType: 'export',
      entityId: currentSnapshot.id,
      entityTitle: `EOD Digest (${activeDate} ${activeSlot})`,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Dispatched EOD webhook digest to ${metadata.eodDigest?.channelName || 'configured webhook'}`,
      severity: res.success ? 'success' : 'danger',
    });
  };

  // Clone current slot to next slot with proper interactive Confirmation Modal
  const handleCloneToNextSlot = async () => {
    if (!currentSnapshot) return;
    const nextSlot: ReportSlot = activeSlot === 'MORNING' ? 'EVENING' : 'MORNING';

    const nextId = `${activeDate}_${nextSlot}`;
    const existingNext = await db.reports.get(nextId);

    const executeClone = async () => {
      const clonedTasks: TaskRow[] = currentSnapshot.tasks.map((t) => ({ ...t }));
      const newReport: ReportSnapshot = {
        id: nextId,
        date: activeDate,
        slot: nextSlot,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: clonedTasks,
        previousSlotSnapshotId: currentSnapshot.id,
      };

      await db.reports.put(newReport);
      setActiveSlot(nextSlot);
      localStorage.setItem(LAST_SLOT_STORAGE_KEY, nextSlot);
      onContextChange?.(activeDate, nextSlot);
      showToast(`Successfully cloned report into ${nextSlot} snapshot!`);
    };

    if (existingNext && existingNext.tasks.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: `Overwrite ${nextSlot} Report?`,
        description: `A snapshot already exists for ${activeDate} (${nextSlot}) containing ${existingNext.tasks.length} tasks. Do you want to overwrite it with the current ${activeSlot} tasks?`,
        confirmLabel: 'Overwrite & Clone',
        variant: 'warning',
        onConfirm: executeClone,
      });
      return;
    }

    await executeClone();
  };

  // Rollover apply
  const handleRolloverApply = async (newTasks: TaskRow[]) => {
    if (!currentSnapshot) return;
    const merged = [...currentSnapshot.tasks, ...newTasks];
    await persistTasks(merged);
    showToast(`Rolled over ${newTasks.length} tasks successfully!`);

    logActivity({
      actionType: 'rollover',
      actionLabel: 'Rollover Executed',
      entityType: 'rollover',
      entityId: `rollover_${activeDate}_${activeSlot}`,
      entityTitle: `${activeDate} (${activeSlot}) Rollover`,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Rolled over ${newTasks.length} incomplete tasks into ${activeSlot} report snapshot`,
      severity: 'warning',
    });
  };

  // High-Resolution 3x PNG Export - Zero Scroll View, Entire Table Content
  const handleExportPng = async () => {
    if (!exportCanvasRef.current || !currentSnapshot) return;
    try {
      setIsExporting(true);

      // Allow 150ms for DOM layout of the 1360px container
      await new Promise((r) => setTimeout(r, 150));

      const node = exportCanvasRef.current;
      const exportWidth = 1360;
      const exportHeight = Math.ceil(node.scrollHeight || node.offsetHeight || 800) + 8;

      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#FFFFFF',
        width: exportWidth,
        height: exportHeight,
        style: {
          position: 'relative',
          left: '0px',
          top: '0px',
          width: `${exportWidth}px`,
          minWidth: `${exportWidth}px`,
          maxWidth: `${exportWidth}px`,
          height: `${exportHeight}px`,
          boxSizing: 'border-box',
          overflow: 'visible',
          transform: 'none',
          padding: '28px',
          margin: '0px',
        },
      });

      const a = document.createElement('a');
      a.download = `Team-Report-${currentSnapshot.date}-${currentSnapshot.slot}.png`;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast(`Full 3x PNG exported: Team-Report-${currentSnapshot.date}-${currentSnapshot.slot}.png`);

      logActivity({
        actionType: 'export',
        actionLabel: 'Report Snapshot Exported',
        entityType: 'export',
        entityId: currentSnapshot.id,
        entityTitle: `Report Snapshot (${currentSnapshot.date} ${currentSnapshot.slot})`,
        actor: currentActor,
        actorRole: currentActorRole,
        details: `Exported 3x high-resolution PNG image (${filteredTasks.length} tasks rendered)`,
        severity: 'info',
      });
    } catch (err: any) {
      showNotice(
        'Export Failed',
        `Failed to generate PNG image: ${err.message || 'Unknown error'}. Please try again.`,
        'danger'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const tasks = currentSnapshot?.tasks || [];
  const historicalTitles = allRecentReports.flatMap((r) => r.tasks.map((t) => t.category));

  // In-table filtered tasks pipeline with multiselect support
  const filteredTasks = tasks.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCat = t.category.toLowerCase().includes(q);
      const matchNotes = t.notes && t.notes.toLowerCase().includes(q);
      if (!matchCat && !matchNotes) return false;
    }
    if (selectedOwnerFilters.length > 0) {
      const hasMatchingOwner = t.ownerIds.some((id) => selectedOwnerFilters.includes(id));
      if (!hasMatchingOwner) return false;
    }
    if (selectedStatusFilters.length > 0) {
      if (!selectedStatusFilters.includes(t.statusId)) return false;
    }
    if (showOverdueOnly) {
      const days = calculateDaysOverdue(t.etaDate, activeDate, metadata.agingRules);
      const isComp = metadata.statuses.find((s) => s.id === t.statusId)?.isCompletedState || false;
      if (days <= 0 || isComp) return false;
    }
    return true;
  });

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedOwnerFilters([]);
    setSelectedStatusFilters([]);
    setShowOverdueOnly(false);
  };

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleConfirmResetActiveTable = async () => {
    setIsResetConfirmOpen(false);

    const reportId = `${activeDate}_${activeSlot}`;
    const taskCount = currentSnapshot?.tasks?.length || 0;
    const updated: ReportSnapshot = currentSnapshot
      ? {
          ...currentSnapshot,
          tasks: [],
          updatedAt: new Date().toISOString(),
        }
      : {
          id: reportId,
          date: activeDate,
          slot: activeSlot,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tasks: [],
        };

    setCurrentSnapshot(updated);
    await db.reports.put(updated);

    handleResetFilters();
    setDensity('compact');
    setSelectedTaskIds([]);

    logActivity({
      actionType: 'batch_delete',
      actionLabel: 'Active Tasks Reset',
      entityType: 'report',
      entityId: reportId,
      entityTitle: `${activeSlot} Task Table (${activeDate})`,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Reset and wiped ${taskCount} task(s) from ${activeSlot} task table (${activeDate})`,
      severity: 'danger',
    });

    const slotLabel = activeSlot.charAt(0) + activeSlot.slice(1).toLowerCase();
    showToast(`Cleared all tasks for ${activeDate} (${slotLabel})!`);
  };

  const handleDensityChange = (newDensity: TableDensity) => {
    setDensity(newDensity);
    logActivity({
      actionType: 'system',
      actionLabel: 'Density Changed',
      entityType: 'report',
      entityId: `${activeDate}_${activeSlot}`,
      entityTitle: `${activeSlot} Task Table (${activeDate})`,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `View density changed to ${newDensity === 'compact' ? '1x (Compact)' : newDensity === 'comfortable' ? '2x (Comfortable)' : '3x (Spacious)'} for current ${activeSlot} table`,
      severity: 'info',
    });
  };

  const handleDateChange = (newDate: string) => {
    setActiveDate(newDate);
    localStorage.setItem(LAST_DATE_STORAGE_KEY, newDate);
    onContextChange?.(newDate, activeSlot);
    logActivity({
      actionType: 'system',
      actionLabel: 'Date Selected',
      entityType: 'report',
      entityId: `${newDate}_${activeSlot}`,
      entityTitle: `${activeSlot} Task Table (${newDate})`,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Switched workspace date to ${newDate}`,
      severity: 'info',
    });
  };

  const handleSelectSlot = (newSlot: ReportSlot) => {
    setActiveSlot(newSlot);
    localStorage.setItem(LAST_SLOT_STORAGE_KEY, newSlot);
    onContextChange?.(activeDate, newSlot);
    logActivity({
      actionType: 'system',
      actionLabel: 'Slot Switched',
      entityType: 'report',
      entityId: `${activeDate}_${newSlot}`,
      entityTitle: `${newSlot} Task Table (${activeDate})`,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Switched active table slot to ${newSlot} for ${activeDate}`,
      severity: 'info',
    });
  };

  const cleanSubtitle = useMemo(() => {
    return getCleanWorkspaceSubtitle(metadata.branding?.companyName, metadata.branding?.teamTagline);
  }, [metadata.branding?.companyName, metadata.branding?.teamTagline]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedOwnerFilters.length > 0 ||
    selectedStatusFilters.length > 0 ||
    showOverdueOnly;

  return (
    <div className="space-y-3 max-w-[1300px] mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 dark:bg-[#08122f] text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 dark:border-[#ff2d5f]/40 backdrop-blur-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-[#ff2d5f]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unified Sticky Controls Bar (Command Bar + Filter Toolbar Stacked Seamlessly) */}
      <div className="sticky top-0 z-20 space-y-1.5 bg-white/95 dark:bg-[#020612]/95 backdrop-blur-md pb-1 pt-0.5">
        {/* Top Header Command Bar */}
        <div className="bg-white dark:bg-[#050c21] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 transition-colors">
          {/* Left: Date Picker + Slot Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Date:
              </span>
              <DatePickerPopover
                value={activeDate}
                onChange={handleDateChange}
                buttonClassName="text-xs font-bold py-1 px-2"
              />

              {/* Distinct "Today" Action Button */}
              {activeDate === getTodayDateStr() ? (
                <button
                  type="button"
                  onClick={() => handleDateChange(getTodayDateStr())}
                  title="Currently on Today's date"
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60 shadow-2xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Today</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDateChange(getTodayDateStr())}
                  title={`Jump to Today (${getTodayDateStr()})`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-black rounded-lg transition-all shadow-sm cursor-pointer bg-gradient-to-r from-[#ff2d5f] via-rose-500 to-pink-600 hover:from-[#e62252] hover:to-pink-700 text-white shadow-[#ff2d5f]/25 hover:scale-105 active:scale-95 animate-in fade-in"
                >
                  <Sparkles className="w-3 h-3 text-white" />
                  <span>Today</span>
                </button>
              )}
            </div>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-[#142552] hidden sm:block" />

            {/* Slot Pills */}
            <div className="inline-flex p-0.5 bg-slate-100 dark:bg-[#020612] rounded-lg border border-slate-200 dark:border-[#142552]">
              {SLOTS.map((slot) => {
                const isActive = activeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleSelectSlot(slot)}
                    className={cn(
                      'px-2.5 py-0.5 rounded-md text-xs font-bold transition-all',
                      isActive
                        ? 'bg-[#ff2d5f] text-white font-black shadow-xs scale-102'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#08122f]'
                    )}
                  >
                    {slot.charAt(0) + slot.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center: Multi-slot Workflow Actions */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleCloneToNextSlot}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-[#08122f] hover:bg-slate-200 dark:hover:bg-[#0c1a40] border border-slate-300 dark:border-[#142552] text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all shadow-2xs hover:border-[#ff2d5f]/50 cursor-pointer"
              title="Clone current snapshot to evening or morning"
            >
              <Copy className="w-3 h-3 text-[#ff2d5f]" />
              <span>Clone to {activeSlot === 'MORNING' ? 'Evening' : 'Morning'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRolloverModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-[#08122f] hover:bg-slate-200 dark:hover:bg-[#0c1a40] border border-slate-300 dark:border-[#142552] text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all shadow-2xs hover:border-[#ff2d5f]/50 cursor-pointer"
              title="Roll forward / carry forward incomplete tasks from previous report or yesterday"
            >
              <RefreshCw className="w-3 h-3 text-[#ff2d5f]" />
              <span>Rollover Tasks</span>
            </button>

            {/* Highlight EOD Changes Toggle */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-[#08122f] border border-slate-300 dark:border-[#142552] rounded-lg cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#0c1a40] transition-colors">
              <input
                type="checkbox"
                checked={highlightEodChanges}
                onChange={(e) => setHighlightEodChanges(e.target.checked)}
                className="w-3 h-3 text-[#ff2d5f] rounded border-slate-300 dark:border-[#142552] focus:ring-[#ff2d5f]"
              />
              <span>EOD Highlights</span>
            </label>
          </div>

          {/* Right: Primary Brand Actions in #ff2d5f */}
          <div className="flex items-center gap-2">
            {/* Unified Export Hub Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportHubOpen(!isExportHubOpen)}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-[#ff2d5f]/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                title="Unified Export Hub (Shortcut: E for PNG)"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isExporting ? 'Generating...' : 'Export Hub'}</span>
                <ChevronDown className={`w-3 h-3 text-white transition-transform ${isExportHubOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportHubOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsExportHubOpen(false)} />
                  <div className="absolute right-0 mt-1.5 z-50 w-60 bg-white dark:bg-[#050c21] rounded-xl shadow-2xl border border-slate-200 dark:border-[#142552] p-1.5 text-xs animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportHubOpen(false);
                        handleExportPng();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#08122f] flex items-center gap-2.5 font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-[#ff2d5f] flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">Download PNG</span>
                          <span className="px-1 py-0.2 text-[9px] bg-[#ff2d5f]/20 text-[#ff2d5f] font-mono font-bold rounded">
                            3x
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal">
                          Full report image ({density === 'compact' ? '1x' : density === 'comfortable' ? '2x' : '3x'} density)
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopySlack}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#08122f] flex items-center gap-2.5 font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div>
                        <span className="block font-bold">{copiedSlack ? 'Copied to Clipboard!' : 'Copy Slack Standup'}</span>
                        <span className="text-[10px] text-slate-500 font-normal">Markdown bullet digest</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#08122f] flex items-center gap-2.5 font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div>
                        <span className="block font-bold">Export Tabular CSV</span>
                        <span className="text-[10px] text-slate-500 font-normal">For Excel / Google Sheets</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleBackupTasksJson}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#08122f] flex items-center gap-2.5 font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <FileJson className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                      <div>
                        <span className="block font-bold">Backup Tasks (.json)</span>
                        <span className="text-[10px] text-slate-500 font-normal">Download all report tasks as JSON</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExportHubOpen(false);
                        tasksJsonInputRef.current?.click();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#08122f] flex items-center gap-2.5 font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div>
                        <span className="block font-bold">Restore Tasks (.json)</span>
                        <span className="text-[10px] text-slate-500 font-normal">Upload &amp; restore tasks from JSON</span>
                      </div>
                    </button>

                    <div className="h-[1px] bg-slate-100 dark:bg-[#142552] my-1" />

                    <button
                      type="button"
                      onClick={handleDispatchWebhook}
                      disabled={dispatchingWebhook}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-[#ff2d5f]/10 flex items-center gap-2.5 font-semibold text-rose-900 dark:text-[#ff2d5f] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-4 h-4 text-[#ff2d5f] flex-shrink-0" />
                      <div>
                        <span className="block font-bold">{dispatchingWebhook ? 'Dispatching...' : 'Dispatch EOD Webhook'}</span>
                        <span className="text-[10px] text-slate-500 font-normal">Push digest to team channel</span>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Hidden Input for Tasks JSON Upload */}
            <input
              type="file"
              ref={tasksJsonInputRef}
              accept=".json"
              onChange={handleTasksJsonFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setIsTaskModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-[#ff2d5f]/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Add Task Plan (Shortcut: N)"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Task</span>
              <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] bg-white/20 rounded text-white font-mono font-bold">
                N
              </kbd>
            </button>
          </div>
        </div>

        {/* In-Table Search, Filter & Density Switcher Toolbar */}
        {currentSnapshot && (
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedOwnerFilters={selectedOwnerFilters}
            onOwnerFiltersChange={setSelectedOwnerFilters}
            selectedStatusFilters={selectedStatusFilters}
            onStatusFiltersChange={setSelectedStatusFilters}
            showOverdueOnly={showOverdueOnly}
            onToggleOverdueOnly={() => setShowOverdueOnly(!showOverdueOnly)}
            onResetFilters={handleResetFilters}
            onResetAll={() => setIsResetConfirmOpen(true)}
            onResetClick={() => setIsResetConfirmOpen(true)}
            hasActiveFilters={hasActiveFilters}
            density={density}
            onDensityChange={handleDensityChange}
            metadata={metadata}
            totalTasks={tasks.length}
            filteredTasksCount={filteredTasks.length}
          />
        )}
      </div>

      {/* Main Interactive Table Workspace */}
      <div className="space-y-3">
        <div className="bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl p-4 transition-colors">
          <div className="mb-4 pb-3 border-b border-slate-200 dark:border-[#142552] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                {metadata.branding?.companyName || formatReportTitle(activeDate, activeSlot)}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {cleanSubtitle}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="px-2.5 py-1 bg-slate-100 dark:bg-[#08122f] rounded-md text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#142552]">
                Tasks: <strong className="text-slate-900 dark:text-white">{filteredTasks.length}</strong>
              </span>
              <span className="px-2.5 py-1 bg-rose-50 dark:bg-[#ff2d5f]/15 text-rose-900 dark:text-[#ff2d5f] rounded-md border border-rose-200 dark:border-[#ff2d5f]/30 font-bold">
                Slot: <strong>{activeSlot}</strong>
              </span>
            </div>
          </div>

          {/* The Onscreen Spreadsheet Table */}
          <SpreadsheetTable
            tasks={filteredTasks}
            metadata={metadata}
            activeReportDate={activeDate}
            previousSlotSnapshot={previousSlotSnapshot}
            highlightEodChanges={highlightEodChanges}
            isExportMode={false}
            density={density}
            selectedTaskIds={selectedTaskIds}
            onToggleSelectTask={handleToggleSelectTask}
            onSelectAllTasks={handleSelectAllTasks}
            onBatchUpdateTasks={handleBatchUpdateTasks}
            onBatchDeleteTasks={handleBatchDeleteTasks}
            onTasksReorder={handleTasksReorder}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onQuickUpdateTask={handleQuickUpdateTask}
          />
        </div>
      </div>

      {/* Dedicated Unconstrained Export Canvas (Zero Scroll View, Captures Filtered Tasks with Density) */}
      {currentSnapshot && (
        <ReportExportCanvas
          report={{
            ...currentSnapshot,
            tasks: filteredTasks,
          }}
          metadata={metadata}
          containerRef={exportCanvasRef}
          isExporting={isExporting}
          density={density}
        />
      )}

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTaskFromModal}
        initialTask={editingTask}
        metadata={metadata}
        activeReportDate={activeDate}
        historicalTaskTitles={historicalTitles}
      />

      <RolloverModal
        isOpen={isRolloverModalOpen}
        onClose={() => setIsRolloverModalOpen(false)}
        availableReports={allRecentReports.filter((r) => r.id !== `${activeDate}_${activeSlot}` && r.tasks.length > 0)}
        currentTasks={currentSnapshot?.tasks || []}
        metadata={metadata}
        activeSlot={activeSlot}
        activeDate={activeDate}
        onRollover={handleRolloverApply}
      />

      {/* Reset Confirmation Modal */}
      <ConfirmationModal
        isOpen={isResetConfirmOpen}
        title={`Reset & Clear ${activeSlot.charAt(0) + activeSlot.slice(1).toLowerCase()} Tasks?`}
        description={`Are you sure you want to completely wipe all tasks from the ${activeSlot.charAt(0) + activeSlot.slice(1).toLowerCase()} task table for ${activeDate}? Only this current snapshot (${activeDate} ${activeSlot.charAt(0) + activeSlot.slice(1).toLowerCase()}) will be cleared; other dates and slots will remain unchanged.`}
        confirmLabel={`Clear ${activeSlot.charAt(0) + activeSlot.slice(1).toLowerCase()} Tasks`}
        cancelLabel="Cancel"
        variant="danger"
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleConfirmResetActiveTable}
      />

      {/* Global Confirmation & Notice Modal */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        variant={confirmDialog.variant}
        isAlertOnly={confirmDialog.isAlertOnly}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
};
