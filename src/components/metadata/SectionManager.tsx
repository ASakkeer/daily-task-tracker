import React, { useState } from 'react';
import { SectionItem } from '../../types';
import { Plus, Trash2, ArrowUp, ArrowDown, Bug, Layers } from 'lucide-react';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface SectionManagerProps {
  sections: SectionItem[];
  onChange: (sections: SectionItem[]) => void;
}

export const SectionManager: React.FC<SectionManagerProps> = ({ sections, onChange }) => {
  const [newTitle, setNewTitle] = useState('');
  const [isBugSection, setIsBugSection] = useState(false);

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

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newSec: SectionItem = {
      id: `sec_${Date.now()}`,
      title: newTitle.trim(),
      order: sections.length + 1,
      isBugSection,
    };

    onChange([...sections, newSec]);
    setNewTitle('');
    setIsBugSection(false);
  };

  const handleUpdate = (id: string, updates: Partial<SectionItem>) => {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDelete = (id: string) => {
    if (sections.length <= 1) {
      setConfirmModal({
        isOpen: true,
        title: 'Section Requirement',
        message: 'You must have at least one section configured for task groupings.',
        confirmText: 'Understood',
        variant: 'warning',
        isAlertOnly: true,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const sec = sections.find((s) => s.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Remove Section Divider',
      message: `Are you sure you want to remove section "${sec?.title}"? Tasks belonging to it will remain.`,
      confirmText: 'Remove',
      variant: 'danger',
      isAlertOnly: false,
      onConfirm: () => {
        onChange(sections.filter((s) => s.id !== id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const items = [...sections];
    const [moved] = items.splice(index, 1);
    items.splice(newIdx, 0, moved);
    onChange(items.map((it, idx) => ({ ...it, order: idx + 1 })));
  };

  return (
    <div className="space-y-6">
      {/* Add Section */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1">
          Add Table Section Divider
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 font-medium">
          Create section dividers (like &quot;Main Tasks&quot;, &quot;All Bugs&quot;, &quot;Mobile Pod&quot;) that split table rows.
        </p>

        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Section Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. All Bugs, Performance, Infrastructure"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 py-2">
              <input
                type="checkbox"
                checked={isBugSection}
                onChange={(e) => setIsBugSection(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-900 focus:ring-rose-500"
              />
              <span className="flex items-center gap-1">
                <Bug className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                Track as Bug Section
              </span>
            </label>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Add Section
            </button>
          </div>
        </form>
      </div>

      {/* Existing Sections List */}
      <div className="bg-white dark:bg-[#050c21] rounded-xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="p-4 bg-slate-50/80 dark:bg-[#020612]/70 border-b border-slate-200 dark:border-[#142552] flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Active Sections ({sections.length})
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sections render as bold divider bands across the table</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-[#142552]/40">
          {sections.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No sections added yet. Use the form above to add your first section (e.g. &quot;Main Tasks&quot;, &quot;All Bugs&quot;).
            </div>
          ) : (
            sections.map((sec, index) => (
            <div
              key={sec.id}
              className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
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
                    disabled={index === sections.length - 1}
                    className="hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 p-0.5 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                    {sec.isBugSection ? <Bug className="w-4 h-4 text-rose-600 dark:text-rose-400" /> : <Layers className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
                  </div>

                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) => handleUpdate(sec.id, { title: e.target.value })}
                    className="text-xs font-black text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-[#ff2d5f] focus:outline-none px-1"
                  />

                  {sec.isBugSection && (
                    <span className="text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-transparent dark:border-rose-800/60 font-bold px-2 py-0.5 rounded-full">
                      Bug Category
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={sec.isBugSection || false}
                    onChange={(e) => handleUpdate(sec.id, { isBugSection: e.target.checked })}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-900 focus:ring-rose-500"
                  />
                  <span>Is Bug Section</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDelete(sec.id)}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                  title="Remove Section"
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
