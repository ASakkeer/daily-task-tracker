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
import { ColumnConfig, CustomColumnType } from '../../types';
import {
  Columns3,
  RotateCcw,
  Check,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Link2,
  Hash,
  Tag as TagIcon,
  Type,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { DEFAULT_COLUMNS } from '../../db/seed';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { CustomDropdown } from '../common/CustomDropdown';

interface ColumnManagerProps {
  columns: ColumnConfig[];
  onChange: (columns: ColumnConfig[]) => void;
}

const TYPE_BADGES: Record<
  CustomColumnType,
  { label: string; icon: React.FC<{ className?: string }>; color: string }
> = {
  link: {
    label: 'Link / URL',
    icon: Link2,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  },
  tag: {
    label: 'Tag / Badge',
    icon: TagIcon,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800',
  },
  number: {
    label: 'Number',
    icon: Hash,
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  },
  text: {
    label: 'Plain Text',
    icon: Type,
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
  },
};

interface SortableColumnRowProps {
  col: ColumnConfig;
  index: number;
  total: number;
  onLabelChange: (id: string, newLabel: string) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

const SortableColumnRow: React.FC<SortableColumnRowProps> = ({
  col,
  index,
  total,
  onLabelChange,
  onToggleVisibility,
  onDelete,
  onMove,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const colType: CustomColumnType = col.type || 'text';
  const typeMeta = TYPE_BADGES[colType];
  const TypeIcon = typeMeta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3.5 grid grid-cols-12 items-center gap-3 hover:bg-slate-50/70 dark:hover:bg-[#07112c] transition-colors ${
        isDragging ? 'bg-rose-50 dark:bg-[#ff2d5f]/10 border-2 border-[#ff2d5f] rounded-xl' : ''
      }`}
    >
      {/* 1. Drag handle & Position Controls */}
      <div className="col-span-1 flex items-center gap-1 text-slate-400 dark:text-slate-500">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 hover:text-slate-800 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing rounded"
          title="Drag row to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onMove(index, 'up')}
            disabled={index === 0}
            className="hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 p-0.5 cursor-pointer"
            title="Move column up"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 'down')}
            disabled={index === total - 1}
            className="hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 p-0.5 cursor-pointer"
            title="Move column down"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. Column Key / Identity */}
      <div className="col-span-3 flex items-center gap-2">
        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
          {col.defaultLabel}
        </span>
        {col.isCustom ? (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${typeMeta.color}`}>
            <TypeIcon className="w-2.5 h-2.5" />
            {typeMeta.label}
          </span>
        ) : !col.isOptional ? (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-semibold">(Core)</span>
        ) : (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">(Optional)</span>
        )}
      </div>

      {/* 3. Editable Custom Display Header */}
      <div className="col-span-5">
        <input
          type="text"
          value={col.customLabel}
          onChange={(e) => onLabelChange(col.id, e.target.value)}
          placeholder={col.defaultLabel}
          className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
        />
      </div>

      {/* 4. Visibility & Actions */}
      <div className="col-span-3 flex items-center justify-end gap-2">
        {col.isOptional || col.isCustom ? (
          <button
            type="button"
            onClick={() => onToggleVisibility(col.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
              col.visible
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{col.visible ? 'Visible' : 'Hidden'}</span>
          </button>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-600" /> Always On
          </span>
        )}

        {col.isCustom && (
          <button
            type="button"
            onClick={() => onDelete(col.id)}
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
            title="Delete Custom Column"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export const ColumnManager: React.FC<ColumnManagerProps> = ({ columns = DEFAULT_COLUMNS, onChange }) => {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<CustomColumnType>('text');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'cyan';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'danger',
    onConfirm: () => {},
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      const newItems = arrayMove(columns, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        order: idx + 1,
      }));
      onChange(newItems);
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= columns.length) return;
    const items = [...columns];
    const [moved] = items.splice(index, 1);
    items.splice(newIdx, 0, moved);
    onChange(items.map((it, idx) => ({ ...it, order: idx + 1 })));
  };

  const handleLabelChange = (id: string, newCustomLabel: string) => {
    const updated = columns.map((col) =>
      col.id === id ? { ...col, customLabel: newCustomLabel } : col
    );
    onChange(updated);
  };

  const handleToggleVisibility = (id: string) => {
    const updated = columns.map((col) => {
      if (col.id === id && (col.isOptional || col.isCustom)) {
        return { ...col, visible: !col.visible };
      }
      return col;
    });
    onChange(updated);
  };

  const handleAddCustomColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColLabel.trim()) return;

    const slug = `custom_${newColLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')}_${Date.now().toString(36)}`;

    const newCol: ColumnConfig = {
      id: `col_${Date.now()}`,
      key: slug,
      defaultLabel: newColLabel.trim(),
      customLabel: newColLabel.trim(),
      visible: true,
      isOptional: true,
      isCustom: true,
      type: newColType,
      width: newColType === 'link' ? '140px' : newColType === 'number' ? '90px' : '130px',
      order: columns.length + 1,
    };

    onChange([...columns, newCol]);
    setNewColLabel('');
    setNewColType('text');
    setIsAddingCustom(false);
  };

  const handleDeleteCustomColumn = (id: string) => {
    const col = columns.find((c) => c.id === id);
    if (!col) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Custom Column',
      message: `Are you sure you want to delete custom column "${col.customLabel || col.defaultLabel}"? Historical values will remain preserved in database snapshots.`,
      confirmText: 'Delete Column',
      variant: 'danger',
      onConfirm: () => {
        onChange(columns.filter((c) => c.id !== id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleResetDefaults = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset to Factory Columns',
      message: 'Are you sure you want to reset all columns to default ordering and labels? Custom columns will be removed.',
      confirmText: 'Reset Defaults',
      variant: 'warning',
      onConfirm: () => {
        onChange(DEFAULT_COLUMNS);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const allColIds = columns.map((c) => c.id);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Columns3 className="w-4 h-4 text-[#ff2d5f]" />
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
              Table Column Labels, Reordering &amp; Custom Fields
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Drag rows to reorder table headers. Rename column titles, toggle visibility, or add custom fields like JIRA Keys or PR URLs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddingCustom(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff2d5f] hover:bg-[#e62252] text-white font-black rounded-lg text-xs transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            + Add Custom Column
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors border border-transparent dark:border-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Add Custom Column Form */}
      {isAddingCustom && (
        <form
          onSubmit={handleAddCustomColumn}
          className="bg-rose-50/60 dark:bg-[#ff2d5f]/10 border border-rose-200/80 dark:border-[#ff2d5f]/30 p-4 rounded-xl space-y-4 animate-in fade-in transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#ff2d5f]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-950 dark:text-[#ff2d5f]">
                Create Dynamic Custom Column
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingCustom(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6 space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Column Name / Header
              </label>
              <input
                type="text"
                autoFocus
                value={newColLabel}
                onChange={(e) => setNewColLabel(e.target.value)}
                placeholder="e.g. JIRA Key, PR URL, Story Points, Environment"
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400"
                required
              />
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Data Type
              </label>
              <CustomDropdown
                value={newColType}
                onChange={(val) => setNewColType(val as CustomColumnType)}
                options={[
                  { value: 'text', label: 'Plain Text (e.g. Sprint, Env, Scope)' },
                  { value: 'link', label: 'Link / URL (e.g. GitHub PR, JIRA Issue)' },
                  { value: 'number', label: 'Number (e.g. Story Points, Weight)' },
                  { value: 'tag', label: 'Tag / Badge (e.g. Frontend, Critical)' },
                ]}
                className="w-full text-xs"
                buttonClassName="py-1 px-3 text-xs font-semibold"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full py-1.5 px-3 bg-[#ff2d5f] hover:bg-[#e62252] text-white font-black rounded-lg text-xs transition-all shadow-md shadow-[#ff2d5f]/20 cursor-pointer"
              >
                Create Column
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Unified Draggable Columns Table */}
      <div className="bg-white dark:bg-[#050c21] rounded-xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="p-4 bg-slate-50/80 dark:bg-[#020612]/70 border-b border-slate-200 dark:border-[#142552] grid grid-cols-12 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
          <span className="col-span-1">Reorder</span>
          <span className="col-span-3">Column Title &amp; Type</span>
          <span className="col-span-5">Custom Display Header (Editable)</span>
          <span className="col-span-3 text-right">Visibility &amp; Actions</span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allColIds} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-slate-100 dark:divide-[#142552]/40">
              {columns.map((col, index) => (
                <SortableColumnRow
                  key={col.id}
                  col={col}
                  index={index}
                  total={columns.length}
                  onLabelChange={handleLabelChange}
                  onToggleVisibility={handleToggleVisibility}
                  onDelete={handleDeleteCustomColumn}
                  onMove={handleMove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
