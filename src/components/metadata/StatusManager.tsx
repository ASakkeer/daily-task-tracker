import React, { useState } from 'react';
import { StatusItem } from '../../types';
import { Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react';
import { ColorPickerPopover } from '../common/ColorPickerPopover';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface StatusManagerProps {
  statuses: StatusItem[];
  onChange: (statuses: StatusItem[]) => void;
}

export const StatusManager: React.FC<StatusManagerProps> = ({ statuses, onChange }) => {
  const [newLabel, setNewLabel] = useState('');
  const [newBgColor, setNewBgColor] = useState('#FFFFFF');
  const [newTextColor, setNewTextColor] = useState('#1E293B');
  const [newIsCompleted, setNewIsCompleted] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'cyan';
    isAlertOnly?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'danger',
    isAlertOnly: false,
    onConfirm: () => {},
  });

  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const newStatus: StatusItem = {
      id: `status_${Date.now()}`,
      label: newLabel.trim(),
      bgColor: newBgColor,
      textColor: newTextColor,
      isCompletedState: newIsCompleted,
      order: statuses.length + 1,
    };

    onChange([...statuses, newStatus]);
    setNewLabel('');
    setNewBgColor('#FFFFFF');
    setNewTextColor('#1E293B');
    setNewIsCompleted(false);
  };

  const handleUpdate = (id: string, updates: Partial<StatusItem>) => {
    const updated = statuses.map((s) => (s.id === id ? { ...s, ...updates } : s));
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    if (statuses.length <= 1) {
      setConfirmModal({
        isOpen: true,
        title: 'Status Requirement',
        message: 'You must have at least one status configured in the system.',
        confirmText: 'Understood',
        variant: 'warning',
        isAlertOnly: true,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const s = statuses.find((item) => item.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Status',
      message: `Are you sure you want to remove the status "${s?.label}"?`,
      confirmText: 'Delete',
      variant: 'danger',
      isAlertOnly: false,
      onConfirm: () => {
        onChange(statuses.filter((item) => item.id !== id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= statuses.length) return;
    const items = [...statuses];
    const [moved] = items.splice(index, 1);
    items.splice(newIdx, 0, moved);
    onChange(items.map((it, idx) => ({ ...it, order: idx + 1 })));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1">
          Add New Status
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 font-medium">
          Define task statuses and their visual highlights for reports and tables.
        </p>

        <form onSubmit={handleAddStatus} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Status Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Blocked, Under Review"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-semibold"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Background</label>
            <ColorPickerPopover color={newBgColor} onChange={setNewBgColor} />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Text Color</label>
            <ColorPickerPopover color={newTextColor} onChange={setNewTextColor} />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 py-2">
              <input
                type="checkbox"
                checked={newIsCompleted}
                onChange={(e) => setNewIsCompleted(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-900 focus:ring-emerald-500"
              />
              <span>Counts as Completed</span>
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Add Status
            </button>
          </div>
        </form>
      </div>

      {/* List of configured statuses */}
      <div className="bg-white dark:bg-[#050c21] rounded-xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="p-4 bg-slate-50/80 dark:bg-[#020612]/70 border-b border-slate-200 dark:border-[#142552] flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Configured Statuses ({statuses.length})
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Order determines appearance in dropdowns</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-[#142552]/40">
          {statuses.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No custom statuses configured yet. Use the form above to add your first status (e.g. &quot;Not Started&quot;, &quot;In Progress&quot;, &quot;Completed&quot;).
            </div>
          ) : (
            statuses.map((status, index) => (
            <div
              key={status.id}
              className="p-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5 text-slate-400 dark:text-slate-500">
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 p-0.5 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === statuses.length - 1}
                    className="hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 p-0.5 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className="px-2.5 py-1 text-xs font-bold rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs"
                    style={{ backgroundColor: status.bgColor, color: status.textColor }}
                  >
                    {status.label}
                  </span>
                  <input
                    type="text"
                    value={status.label}
                    onChange={(e) => handleUpdate(status.id, { label: e.target.value })}
                    className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-[#ff2d5f] focus:outline-none px-1 py-0.5"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <ColorPickerPopover
                  label="Bg:"
                  color={status.bgColor}
                  onChange={(c) => handleUpdate(status.id, { bgColor: c })}
                />

                <ColorPickerPopover
                  label="Text:"
                  color={status.textColor}
                  onChange={(c) => handleUpdate(status.id, { textColor: c })}
                />

                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={status.isCompletedState}
                    onChange={(e) => handleUpdate(status.id, { isCompletedState: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-900 focus:ring-emerald-500"
                  />
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Completed?
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDelete(status.id)}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                  title="Delete Status"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )))}
        </div>
      </div>

      {/* Confirmation / Alert Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        isAlertOnly={confirmModal.isAlertOnly}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
