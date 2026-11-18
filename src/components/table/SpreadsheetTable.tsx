import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  ExternalLink,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AppMetadata, TaskRow, ReportSnapshot, TableDensity, ColumnConfig } from '../../types';
import { calculateDaysOverdue, getAgingStyle } from '../../utils/aging';
import { formatDateSafe } from '../../utils/date';
import { cn } from '../../utils/cn';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { CustomDropdown, CustomDropdownOption } from '../common/CustomDropdown';

interface SpreadsheetTableProps {
  tasks: TaskRow[];
  metadata: AppMetadata;
  activeReportDate: string;
  previousSlotSnapshot?: ReportSnapshot | null;
  highlightEodChanges?: boolean;
  isExportMode?: boolean;
  density?: TableDensity;
  selectedTaskIds?: string[];
  onToggleSelectTask?: (id: string) => void;
  onSelectAllTasks?: (taskIds: string[]) => void;
  onBatchUpdateTasks?: (taskIds: string[], updates: Partial<TaskRow>) => void;
  onBatchDeleteTasks?: (taskIds: string[]) => void;
  onTasksReorder: (tasks: TaskRow[]) => void;
  onEditTask: (task: TaskRow) => void;
  onDeleteTask: (taskId: string) => void;
  onQuickUpdateTask: (taskId: string, updates: Partial<TaskRow>) => void;
}

interface SortableRowProps {
  task: TaskRow;
  metadata: AppMetadata;
  activeReportDate: string;
  isExportMode?: boolean;
  isChangedSinceMorning?: boolean;
  density?: TableDensity;
  isConfidenceVisible?: boolean;
  visibleCustomCols?: ColumnConfig[];
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onQuickUpdate: (updates: Partial<TaskRow>) => void;
}

const SortableRow: React.FC<SortableRowProps> = ({
  task,
  metadata,
  activeReportDate,
  isExportMode = false,
  isChangedSinceMorning = false,
  density = 'comfortable',
  isConfidenceVisible = true,
  visibleCustomCols = [],
  isSelected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onQuickUpdate,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isExportMode,
  });

  const [inlineNotes, setInlineNotes] = useState(task.notes || '');
  const [completionText, setCompletionText] = useState(String(task.completionPct ?? ''));
  const [confidenceText, setConfidenceText] = useState(String(task.confidencePct ?? ''));
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setInlineNotes(task.notes || '');
  }, [task.notes]);

  React.useEffect(() => {
    setCompletionText(String(task.completionPct ?? ''));
  }, [task.completionPct]);

  React.useEffect(() => {
    setConfidenceText(String(task.confidencePct ?? ''));
  }, [task.confidencePct]);

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  React.useEffect(() => {
    adjustTextareaHeight();
  }, [inlineNotes]);

  const handleCompletionBlur = () => {
    let num = parseInt(completionText, 10);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;
    if (num < 0) num = 0;
    setCompletionText(String(num));
    if (num !== task.completionPct) {
      const updates: Partial<TaskRow> = { completionPct: num };
      if (num === 100) {
        updates.confidencePct = 100;
        updates.previousCompletionPct = task.completionPct;
        updates.previousConfidencePct = task.confidencePct;
        const completedSt = metadata.statuses.find((s) => s.isCompletedState);
        if (completedSt) updates.statusId = completedSt.id;
      }
      onQuickUpdate(updates);
    }
  };

  const handleConfidenceBlur = () => {
    let num = parseInt(confidenceText, 10);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;
    if (num < 0) num = 0;
    setConfidenceText(String(num));
    if (num !== task.confidencePct) {
      onQuickUpdate({ confidencePct: num });
    }
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 40 : 'auto',
  };

  const statusConfig = metadata.statuses.find((s) => s.id === task.statusId);
  const isCompleted = statusConfig?.isCompletedState || task.completionPct === 100;

  const daysOverdue = calculateDaysOverdue(task.etaDate, activeReportDate);
  const etaAgingStyle = getAgingStyle(
    daysOverdue,
    isCompleted,
    metadata.agingRules,
    '#DCFCE7',
    '#166534'
  );

  // Status cell style
  const statusBg = task.customStatus ? task.customStatus.bgColor : statusConfig?.bgColor || '#FFFFFF';
  const statusText = task.customStatus ? task.customStatus.textColor : statusConfig?.textColor || '#0F172A';
  const statusLabel = task.customStatus ? task.customStatus.label : statusConfig?.label || (task.statusId || 'No Status');

  // Owners resolution
  const resolvedOwners = task.ownerIds.map((id) => metadata.owners.find((o) => o.id === id)).filter(Boolean);
  const ownersDisplayText =
    task.customOwnerText ||
    (resolvedOwners.length > 0 ? resolvedOwners.map((o) => o?.name).join(', ') : 'Unassigned');

  const handleNotesBlur = () => {
    if (inlineNotes !== task.notes) {
      onQuickUpdate({ notes: inlineNotes });
    }
  };

  // Density padding classes
  const pyClass = density === 'compact' ? 'py-1' : density === 'spacious' ? 'py-3' : 'py-2';
  const textClass = density === 'compact' ? 'text-[11px]' : density === 'spacious' ? 'text-sm' : 'text-xs';

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'group transition-colors',
        isSelected
          ? 'bg-rose-50/80 dark:bg-[#ff2d5f]/15 border-l-4 border-l-[#ff2d5f]'
          : isCompleted
          ? 'bg-emerald-50/30 dark:bg-emerald-950/20'
          : 'bg-white dark:bg-[#020612] hover:bg-slate-50/90 dark:hover:bg-[#07112c]',
        isChangedSinceMorning && !isExportMode && !isSelected && 'border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20'
      )}
    >
      {/* Drag & Controls column (hidden during export) */}
      {!isExportMode && (
        <td className={cn('w-[40px] px-1 text-center border border-slate-300 dark:border-[#142552]', pyClass)}>
          <div className="flex items-center justify-center gap-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-3.5 h-3.5 text-[#ff2d5f] rounded border-slate-300 dark:border-[#142552] focus:ring-[#ff2d5f] cursor-pointer"
              title="Select row for batch actions"
            />
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="p-0.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing rounded transition-colors"
              title="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      )}

      {/* 1. Category / Task */}
      <td
        onDoubleClick={onEdit}
        className={cn('px-3 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-[#142552] align-middle cursor-default', pyClass, textClass)}
        title="Double-click to open full editor"
      >
        <div className="flex items-center gap-1.5">
          {isChangedSinceMorning && !isExportMode && (
            <span
              className="text-[9px] px-1 py-0.2 bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold rounded flex-shrink-0"
              title="Changed since morning"
            >
              PM Update
            </span>
          )}
          <span className="font-semibold leading-relaxed block break-words text-slate-900 dark:text-slate-100">{task.category}</span>
        </div>
      </td>

      {/* 2. Completion % - Full Cell Text Input */}
      <td
        className={cn(
          'p-0 text-center font-bold border border-slate-300 dark:border-[#142552] align-middle font-mono',
          isCompleted ? 'bg-[#DCFCE7] text-[#166534] dark:bg-emerald-950/70 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'
        )}
      >
        {isExportMode ? (
          <span className={cn('block py-1', textClass)}>{task.completionPct}%</span>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            value={completionText}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
              setCompletionText(cleaned);
            }}
            onBlur={handleCompletionBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className={cn(
              'w-full h-full min-h-[36px] text-center font-bold font-mono bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#ff2d5f] focus:bg-white dark:focus:bg-[#050c21] text-slate-900 dark:text-slate-100 transition-colors',
              textClass
            )}
            placeholder="0"
          />
        )}
      </td>

      {/* 3. Confidence % (Optional) - Full Cell Text Input */}
      {isConfidenceVisible && (
        <td
          className={cn(
            'p-0 text-center font-bold border border-slate-300 dark:border-[#142552] align-middle font-mono',
            isCompleted ? 'bg-[#DCFCE7] text-[#166534] dark:bg-emerald-950/70 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'
          )}
        >
          {isExportMode ? (
            <span className={cn('block py-1', textClass)}>{task.confidencePct}%</span>
          ) : (
            <input
              type="text"
              inputMode="numeric"
              value={confidenceText}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                setConfidenceText(cleaned);
              }}
              onBlur={handleConfidenceBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className={cn(
                'w-full h-full min-h-[36px] text-center font-bold font-mono bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#ff2d5f] focus:bg-white dark:focus:bg-[#050c21] text-slate-900 dark:text-slate-100 transition-colors',
                textClass
              )}
              placeholder="0"
            />
          )}
        </td>
      )}

      {/* 4. Owner */}
      <td className={cn('px-2.5 font-semibold text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-[#142552] align-middle', pyClass, textClass)}>
        <span className="block break-words" title={ownersDisplayText}>
          {ownersDisplayText}
        </span>
      </td>

      {/* 5. ETA (with Aging Heatmap) */}
      <td
        className={cn('px-1.5 text-center border border-slate-300 dark:border-[#142552] align-middle transition-colors font-medium', pyClass, textClass)}
        style={{
          backgroundColor: etaAgingStyle.bgColor,
          color: etaAgingStyle.textColor,
          fontWeight: etaAgingStyle.isBold ? 700 : 500,
        }}
      >
        <div className="flex flex-col items-center justify-center leading-tight">
          <span>{formatDateSafe(task.etaDate, 'dd-MMM-yyyy')}</span>
          {daysOverdue > 0 && !isCompleted && !isExportMode && (
            <span className="text-[10px] opacity-90 font-mono font-bold">
              (+{daysOverdue}d)
            </span>
          )}
        </div>
      </td>

      {/* 6. Status - Fully Covered Colored Dropdown */}
      <td
        className={cn('p-0 h-full border border-slate-300 dark:border-[#142552] align-middle', textClass)}
        style={{ backgroundColor: statusBg }}
      >
        {isExportMode ? (
          <div
            className="w-full h-full min-h-[36px] flex items-center justify-center px-2 font-bold text-xs"
            style={{ backgroundColor: statusBg, color: statusText }}
          >
            {statusLabel}
          </div>
        ) : (
          <CustomDropdown
            value={task.customStatus ? '__custom__' : task.statusId}
            onChange={(newVal) => {
              if (newVal !== '__custom__') {
                const targetStatus = metadata.statuses.find((s) => s.id === newVal);
                const isTargetComp = targetStatus?.isCompletedState ?? false;
                const wasComp = statusConfig?.isCompletedState ?? false;
                let nextCompletion = task.completionPct;
                let nextConfidence = task.confidencePct;
                let prevComp = task.previousCompletionPct;
                let prevConf = task.previousConfidencePct;

                if (isTargetComp && !wasComp) {
                  // Switching to completed -> remember previous values, set to 100
                  prevComp = task.completionPct;
                  prevConf = task.confidencePct;
                  nextCompletion = 100;
                  nextConfidence = 100;
                } else if (!isTargetComp && wasComp) {
                  // Switching back from completed -> restore the previous values!
                  nextCompletion = task.previousCompletionPct !== undefined ? task.previousCompletionPct : 0;
                  nextConfidence = task.previousConfidencePct !== undefined ? task.previousConfidencePct : 0;
                }

                onQuickUpdate({
                  statusId: newVal,
                  customStatus: undefined,
                  completionPct: nextCompletion,
                  confidencePct: nextConfidence,
                  previousCompletionPct: prevComp,
                  previousConfidencePct: prevConf,
                });
              }
            }}
            options={[
              ...(task.customStatus
                ? [
                    {
                      value: '__custom__',
                      label: `${task.customStatus.label} (Custom)`,
                      color: task.customStatus.bgColor,
                      textColor: task.customStatus.textColor,
                    },
                  ]
                : []),
              ...metadata.statuses.map((s) => ({
                value: s.id,
                label: s.label,
                color: s.bgColor,
                textColor: s.textColor,
              })),
            ]}
            pillMode
            className="w-full h-full"
            buttonClassName="w-full h-full min-h-[34px] rounded-none border-0 px-1 py-1 text-[11px] font-bold justify-between shadow-none"
          />
        )}
      </td>

      {/* 7. Blockers / Notes (Auto-expanding multi-line field with zero scrollbars) */}
      <td className={cn('px-2.5 border border-slate-300 dark:border-[#142552] align-middle', pyClass, textClass)}>
        {isExportMode ? (
          <span
            className={cn(
              'leading-relaxed text-slate-900 block break-words',
              task.highlightNotesBold && 'font-bold text-slate-950'
            )}
          >
            {task.notes || '—'}
          </span>
        ) : (
          <textarea
            ref={textareaRef}
            rows={1}
            value={inlineNotes}
            onChange={(e) => {
              setInlineNotes(e.target.value);
              adjustTextareaHeight();
            }}
            onBlur={handleNotesBlur}
            placeholder="Add blockers or notes..."
            style={{ overflow: 'hidden', resize: 'none' }}
            className={cn(
              'w-full bg-transparent leading-relaxed text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] focus:bg-white dark:focus:bg-[#04091a] focus:px-1.5 focus:py-0.5 rounded transition-all',
              textClass,
              task.highlightNotesBold ? 'font-bold text-slate-950 dark:text-white' : 'font-medium'
            )}
          />
        )}
      </td>

      {/* 8. Dynamic Custom Columns Cells */}
      {visibleCustomCols.map((col) => {
        const val = (task.customFieldValues && task.customFieldValues[col.key]) || '';
        return (
          <td
            key={col.id}
            className={cn('px-2.5 border border-slate-300 dark:border-[#142552] align-middle', pyClass, textClass)}
          >
            {col.type === 'link' ? (
              val ? (
                <a
                  href={val.startsWith('http') ? val : `https://${val}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#ff2d5f] hover:underline font-mono text-[11px] truncate max-w-[130px] font-semibold"
                  title={val}
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{val.replace(/^https?:\/\/(www\.)?/, '')}</span>
                </a>
              ) : (
                <span className="text-slate-400 dark:text-slate-600">—</span>
              )
            ) : col.type === 'tag' ? (
              val ? (
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-[#ff2d5f] border border-rose-200 dark:border-[#ff2d5f]/30">
                  {val}
                </span>
              ) : (
                <span className="text-slate-400 dark:text-slate-600">—</span>
              )
            ) : col.type === 'number' ? (
              <span className="block text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                {val !== '' ? val : '—'}
              </span>
            ) : (
              <span className="text-slate-900 dark:text-slate-100 block truncate" title={val}>
                {val || '—'}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
};

export const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({
  tasks,
  metadata,
  activeReportDate,
  previousSlotSnapshot,
  highlightEodChanges = false,
  isExportMode = false,
  density = 'comfortable',
  selectedTaskIds = [],
  onToggleSelectTask,
  onSelectAllTasks,
  onBatchUpdateTasks,
  onBatchDeleteTasks,
  onTasksReorder,
  onEditTask,
  onDeleteTask,
  onQuickUpdateTask,
}) => {
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getColLabel = (key: string, fallback: string) => {
    const col = metadata.columns?.find((c) => c.key === key);
    if (!col) return fallback;
    if (col.customLabel && col.customLabel !== col.defaultLabel && col.customLabel !== 'Category') {
      return col.customLabel;
    }
    if (col.defaultLabel === 'Category') {
      return fallback;
    }
    return col.customLabel || col.defaultLabel || fallback;
  };

  const isColVisible = (key: string) => {
    const col = metadata.columns?.find((c) => c.key === key);
    return col ? col.visible : true;
  };

  const isConfidenceVisible = isColVisible('confidencePct');
  const visibleCustomCols = (metadata.columns || [])
    .filter((c) => c.isCustom && c.visible)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Group tasks by section in the order defined in metadata
  const groupedSections = metadata.sections
    .map((sec) => {
      const sectionTasks = tasks
        .filter((t) => t.sectionId === sec.id)
        .sort((a, b) => a.order - b.order);
      return { section: sec, tasks: sectionTasks };
    })
    .filter((g) => g.tasks.length > 0 || !isExportMode);

  const orphanTasks = tasks.filter(
    (t) => !metadata.sections.some((s) => s.id === t.sectionId)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    const overTask = tasks.find((t) => t.id === over.id);

    // Draggable strictly works ONLY within the same section!
    if (!activeTask || !overTask || activeTask.sectionId !== overTask.sectionId) {
      return;
    }

    // Reorder strictly within this section's tasks
    const sectionTasks = tasks
      .filter((t) => t.sectionId === activeTask.sectionId)
      .sort((a, b) => a.order - b.order);

    const oldSecIndex = sectionTasks.findIndex((t) => t.id === active.id);
    const newSecIndex = sectionTasks.findIndex((t) => t.id === over.id);

    if (oldSecIndex === -1 || newSecIndex === -1) return;

    const reorderedSectionTasks = arrayMove(sectionTasks, oldSecIndex, newSecIndex).map(
      (task, idx) => ({ ...task, order: idx + 1 })
    );

    // Merge back with other tasks without disturbing any other section
    const updated = tasks.map((t) => {
      if (t.sectionId === activeTask.sectionId) {
        const found = reorderedSectionTasks.find((st) => st.id === t.id);
        return found || t;
      }
      return t;
    });

    onTasksReorder(updated);
  };

  const isTaskChanged = (current: TaskRow): boolean => {
    if (!previousSlotSnapshot || !highlightEodChanges) return false;
    const prevTask = previousSlotSnapshot.tasks.find((t) => t.id === current.id);
    if (!prevTask) return true;
    return (
      prevTask.completionPct !== current.completionPct ||
      prevTask.statusId !== current.statusId ||
      prevTask.notes !== current.notes ||
      prevTask.confidencePct !== current.confidencePct
    );
  };

  const handleDeleteSingleTask = (task: TaskRow) => {
    setDeleteConfirmation({
      isOpen: true,
      title: 'Delete Task Row?',
      description: `Are you sure you want to remove "${task.category}" from this snapshot?`,
      onConfirm: () => onDeleteTask(task.id),
    });
  };

  const handleBatchDeleteClick = () => {
    setDeleteConfirmation({
      isOpen: true,
      title: `Delete ${selectedTaskIds.length} Selected Tasks?`,
      description: `This will permanently remove ${selectedTaskIds.length} tasks from the active report snapshot.`,
      onConfirm: () => onBatchDeleteTasks?.(selectedTaskIds),
    });
  };

  const allTaskIds = tasks.map((t) => t.id);
  const totalCols = (isExportMode ? 6 : 7) + (isConfidenceVisible ? 1 : 0) + visibleCustomCols.length;
  const isAllSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;

  return (
    <div className="w-full relative overflow-hidden bg-white dark:bg-[#020612] rounded-xl shadow-xs dark:shadow-2xl border border-slate-300 dark:border-[#142552] transition-colors">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table
            className="w-full text-left spreadsheet-grid border-collapse"
            style={{ tableLayout: 'fixed', width: '100%' }}
          >
            <colgroup>
              {!isExportMode && <col style={{ width: '40px' }} />}
              <col style={{ width: visibleCustomCols.length > 0 ? '22%' : (isConfidenceVisible ? '25%' : '26.25%') }} />
              <col style={{ width: isConfidenceVisible ? '10.5%' : '13%' }} />
              {isConfidenceVisible && <col style={{ width: '10.5%' }} />}
              <col style={{ width: isConfidenceVisible ? '8.8%' : '10.7%' }} />
              <col style={{ width: isConfidenceVisible ? '8.4%' : '10.2%' }} />
              <col style={{ width: isConfidenceVisible ? '8.8%' : '10.7%' }} />
              <col style={{ width: visibleCustomCols.length > 0 ? '22%' : (isConfidenceVisible ? '25%' : '26.25%') }} />
              {visibleCustomCols.map((col) => (
                <col
                  key={col.id}
                  style={{
                    width: col.width || (col.type === 'link' ? '8%' : col.type === 'number' ? '5%' : '6%'),
                  }}
                />
              ))}
            </colgroup>

            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-slate-200 dark:bg-[#0b1a3d] text-slate-950 dark:text-white text-[10px] font-black uppercase tracking-tight">
                {!isExportMode && (
                  <th style={{ width: '40px' }} className="sticky top-0 bg-slate-200 dark:bg-[#0b1a3d] px-1 py-2 text-center border border-slate-300 dark:border-[#142552] font-black">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onSelectAllTasks?.(tasks.map((t) => t.id));
                        } else {
                          onSelectAllTasks?.([]);
                        }
                      }}
                      className="w-3.5 h-3.5 text-[#ff2d5f] rounded border-slate-300 dark:border-[#142552] focus:ring-[#ff2d5f] cursor-pointer"
                      title="Select / Deselect All Rows"
                    />
                  </th>
                )}
                <th className="sticky top-0 bg-slate-200 dark:bg-[#0b1a3d] px-3 py-2 border border-slate-300 dark:border-[#142552] text-left whitespace-nowrap">
                  {getColLabel('category', 'Tasks')}
                </th>
                <th className="sticky top-0 bg-slate-200 dark:bg-[#0b1a3d] px-0.5 py-2 text-center border border-slate-300 dark:border-[#142552] whitespace-nowrap">
                  <span className="whitespace-nowrap inline-block tracking-tight" title={getColLabel('completionPct', 'Completion %')}>
                    {getColLabel('completionPct', 'Completion %')}
                  </span>
                </th>
                {isConfidenceVisible && (
                  <th className="sticky top-0 bg-slate-200 dark:bg-[#0b1a3d] px-0.5 py-2 text-center border border-slate-300 dark:border-[#142552] whitespace-nowrap">
                    <span className="whitespace-nowrap inline-block tracking-tight" title={getColLabel('confidencePct', 'Confidence %')}>
                      {getColLabel('confidencePct', 'Confidence %')}
                    </span>
                  </th>
                )}
                <th className="sticky top-0 bg-slate-200 dark:bg-[#0b1a3d] px-2 py-2 border border-slate-300 dark:border-[#142552] text-left whitespace-nowrap">
                  {getColLabel('owner', 'Owner')}
                </th>
                <th className="sticky top-0 bg-slate-200 dark:bg-[#0b1a3d] px-1 py-2 text-center border border-slate-300 dark:border-[#142552] whitespace-nowrap">
                  {getColLabel('etaDate', 'ETA')}
                </th>
                <th className="sticky top-0 bg-slate-200 dark:bg-[#0b1a3d] px-1.5 py-2 text-center border border-slate-300 dark:border-[#142552] whitespace-nowrap">
                  {getColLabel('status', 'Status')}
                </th>
                <th className="sticky top-0 bg-slate-200 dark:bg-[#0b1a3d] px-3 py-2 border border-slate-300 dark:border-[#142552] text-left whitespace-nowrap">
                  {getColLabel('notes', 'Blockers / Notes')}
                </th>
                {visibleCustomCols.map((col) => (
                  <th
                    key={col.id}
                    className="sticky top-0 bg-slate-200 dark:bg-[#0b1a3d] px-2 py-2 text-center border border-slate-300 dark:border-[#142552] text-[#ff2d5f] whitespace-nowrap font-black"
                  >
                    {col.customLabel || col.defaultLabel}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {groupedSections.map(({ section, tasks: secTasks }) => (
                <React.Fragment key={section.id}>
                  <tr className="bg-rose-50/90 dark:bg-[#071330] border-l-4 border-l-[#ff2d5f] border-y border-slate-300 dark:border-[#142552]">
                    <td
                      colSpan={totalCols}
                      className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-[#ff2d5f] border border-slate-300 dark:border-[#142552]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#ff2d5f]" />
                          {section.title}
                        </span>
                        {!isExportMode && (
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-[#050c21] px-2 py-0.5 rounded-full border border-slate-200 dark:border-[#142552]">
                            {secTasks.length} {secTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {secTasks.length === 0 && !isExportMode ? (
                    <tr>
                      <td
                        colSpan={totalCols}
                        className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-[#020612]/60 border border-slate-300 dark:border-[#142552]"
                      >
                        No tasks in &quot;{section.title}&quot;. Click &quot;+ Add Task Plan&quot; above to add rows.
                      </td>
                    </tr>
                  ) : (
                    <SortableContext key={section.id} items={secTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {secTasks.map((task) => (
                        <SortableRow
                          key={task.id}
                          task={task}
                          metadata={metadata}
                          activeReportDate={activeReportDate}
                          isExportMode={isExportMode}
                          isChangedSinceMorning={isTaskChanged(task)}
                          density={density}
                          isConfidenceVisible={isConfidenceVisible}
                          visibleCustomCols={visibleCustomCols}
                          isSelected={selectedTaskIds.includes(task.id)}
                          onToggleSelect={() => onToggleSelectTask?.(task.id)}
                          onEdit={() => onEditTask(task)}
                          onDelete={() => handleDeleteSingleTask(task)}
                          onQuickUpdate={(updates) => onQuickUpdateTask(task.id, updates)}
                        />
                      ))}
                    </SortableContext>
                  )}
                </React.Fragment>
              ))}

              {orphanTasks.length > 0 && (
                <React.Fragment>
                  <tr className="bg-slate-200 dark:bg-[#0a1533] border border-slate-300 dark:border-[#142552]">
                    <td
                      colSpan={totalCols}
                      className="px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-rose-300 border border-slate-300 dark:border-[#142552]"
                    >
                      General Tasks
                    </td>
                  </tr>
                  <SortableContext items={orphanTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {orphanTasks.map((task) => (
                      <SortableRow
                        key={task.id}
                        task={task}
                        metadata={metadata}
                        activeReportDate={activeReportDate}
                        isExportMode={isExportMode}
                        isChangedSinceMorning={isTaskChanged(task)}
                        density={density}
                        isConfidenceVisible={isConfidenceVisible}
                        visibleCustomCols={visibleCustomCols}
                        isSelected={selectedTaskIds.includes(task.id)}
                        onToggleSelect={() => onToggleSelectTask?.(task.id)}
                        onEdit={() => onEditTask(task)}
                        onDelete={() => handleDeleteSingleTask(task)}
                        onQuickUpdate={(updates) => onQuickUpdateTask(task.id, updates)}
                      />
                    ))}
                  </SortableContext>
                </React.Fragment>
              )}

              {groupedSections.length === 0 && orphanTasks.length === 0 && (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="px-6 py-12 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-[#020612]/40"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">No tasks logged for this snapshot</span>
                      <span className="text-[11px] text-slate-400 max-w-sm">
                        Click &quot;+ Add Task&quot; in the header above to create your first task row, or configure custom sections in Studio Customization.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </DndContext>

      {/* Floating Cyber Batch Actions Bar */}
      {selectedTaskIds.length > 0 && !isExportMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center gap-2.5 bg-white dark:bg-[#050c21] text-slate-900 dark:text-white px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-[#ff2d5f] backdrop-blur-xl animate-in slide-in-from-bottom-5">
          {/* Selected Badge */}
          <div className="flex items-center gap-2 border-r border-slate-200 dark:border-[#142552] pr-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff2d5f] animate-pulse" />
            <span className="text-xs font-black font-mono text-slate-900 dark:text-[#ff2d5f]">
              {selectedTaskIds.length} Selected
            </span>
          </div>

          {/* Bulk Status Dropdown (Direction Up) */}
          <div className="min-w-[170px]">
            <CustomDropdown
              value=""
              placeholder="Bulk Status..."
              direction="up"
              options={metadata.statuses.map((s) => ({
                value: s.id,
                label: s.label,
                color: s.bgColor,
                textColor: s.textColor,
              }))}
              onChange={(val) => {
                if (val) {
                  const isComp = metadata.statuses.find((s) => s.id === val)?.isCompletedState;
                  onBatchUpdateTasks?.(selectedTaskIds, {
                    statusId: val,
                    customStatus: undefined,
                    completionPct: isComp ? 100 : undefined,
                    confidencePct: isComp ? 100 : undefined,
                  });
                }
              }}
              className="w-full text-xs"
              buttonClassName="py-1 px-2.5 text-xs font-semibold"
            />
          </div>

          {/* Bulk Owner Dropdown (Direction Up) */}
          <div className="min-w-[170px]">
            <CustomDropdown
              value=""
              placeholder="Assign Owner..."
              direction="up"
              options={metadata.owners.map((o) => ({
                value: o.id,
                label: o.name,
                avatarColor: o.avatarColor,
              }))}
              onChange={(val) => {
                if (val) {
                  onBatchUpdateTasks?.(selectedTaskIds, {
                    ownerIds: [val],
                    customOwnerText: undefined,
                  });
                }
              }}
              className="w-full text-xs"
              buttonClassName="py-1 px-2.5 text-xs font-semibold"
            />
          </div>

          {/* Bulk Section Dropdown (Direction Up) */}
          <div className="min-w-[170px]">
            <CustomDropdown
              value=""
              placeholder="Move Section..."
              direction="up"
              options={metadata.sections.map((sec) => ({
                value: sec.id,
                label: sec.title,
              }))}
              onChange={(val) => {
                if (val) {
                  onBatchUpdateTasks?.(selectedTaskIds, {
                    sectionId: val,
                  });
                }
              }}
              className="w-full text-xs"
              buttonClassName="py-1 px-2.5 text-xs font-semibold"
            />
          </div>

          {/* Bulk Complete Button (Brand Primary!) */}
          <button
            type="button"
            onClick={() => {
              const compSt = metadata.statuses.find((s) => s.isCompletedState);
              onBatchUpdateTasks?.(selectedTaskIds, {
                completionPct: 100,
                confidencePct: 100,
                statusId: compSt ? compSt.id : undefined,
              });
            }}
            className="inline-flex items-center gap-1 px-3 py-1 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-[#ff2d5f]/25 hover:scale-[1.02] active:scale-[0.98]"
            title="Mark Selected 100% Completed"
          >
            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>100% Done</span>
          </button>

          {/* Bulk Delete Button */}
          <button
            type="button"
            onClick={handleBatchDeleteClick}
            className="inline-flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-600/20 hover:scale-[1.02] active:scale-[0.98]"
            title="Delete Selected Tasks"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          {/* Deselect / Close */}
          <button
            type="button"
            onClick={() => onSelectAllTasks?.([])}
            className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#08122f] transition-colors ml-1"
            title="Deselect All"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Confirmation Modal for Row Delete & Batch Delete */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title={deleteConfirmation.title}
        description={deleteConfirmation.description}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirmation.onConfirm}
      />
    </div>
  );
};
