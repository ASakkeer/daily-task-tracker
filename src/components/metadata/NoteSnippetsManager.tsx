import React, { useState } from 'react';
import { NoteTemplateItem } from '../../types';
import { Plus, Trash2, FileText, Bold } from 'lucide-react';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface NoteSnippetsManagerProps {
  noteTemplates: NoteTemplateItem[];
  onChange: (templates: NoteTemplateItem[]) => void;
}

export const NoteSnippetsManager: React.FC<NoteSnippetsManagerProps> = ({
  noteTemplates,
  onChange,
}) => {
  const [label, setLabel] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [isBold, setIsBold] = useState(false);

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

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !templateText.trim()) return;

    const newTemplate: NoteTemplateItem = {
      id: `note_${Date.now()}`,
      label: label.trim(),
      templateText: templateText.trim(),
      isBold,
    };

    onChange([...noteTemplates, newTemplate]);
    setLabel('');
    setTemplateText('');
    setIsBold(false);
  };

  const handleUpdate = (id: string, updates: Partial<NoteTemplateItem>) => {
    onChange(noteTemplates.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleDelete = (id: string) => {
    const item = noteTemplates.find((t) => t.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Note Snippet',
      message: `Are you sure you want to remove the quick snippet "${item?.label}"? It will no longer appear as a fast-insert tag in the task editor.`,
      confirmText: 'Delete Snippet',
      variant: 'danger',
      onConfirm: () => {
        onChange(noteTemplates.filter((t) => t.id !== id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <div className="space-y-6">
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

      {/* Add Snippet */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1">
          Add General Engineering &amp; QA Note Snippet
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 font-medium">
          Create reusable snippets that users can tap to quickly inject standard blockers or status updates.
        </p>

        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Pill Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Blocked on API / PR Pending"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              required
            />
          </div>

          <div className="md:col-span-5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Injected Text</label>
            <input
              type="text"
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              placeholder="e.g. Blocked: waiting on upstream backend API endpoint release"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              required
            />
          </div>

          <div className="md:col-span-1">
            <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 py-2">
              <input
                type="checkbox"
                checked={isBold}
                onChange={(e) => setIsBold(e.target.checked)}
                className="w-4 h-4 text-[#ff2d5f] rounded border-slate-300 dark:border-slate-700 dark:bg-slate-900 focus:ring-[#ff2d5f]"
              />
              <Bold className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Add Snippet
            </button>
          </div>
        </form>
      </div>

      {/* Snippets List */}
      <div className="bg-white dark:bg-[#050c21] rounded-xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="p-4 bg-slate-50/80 dark:bg-[#020612]/70 border-b border-slate-200 dark:border-[#142552] flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Available Note Snippets ({noteTemplates.length})
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Appears as fast-insert chips in task editor modal</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-[#142552]/40">
          {noteTemplates.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No note snippets created yet. Use the form above to add one-click note templates.
            </div>
          ) : (
            noteTemplates.map((item) => (
            <div
              key={item.id}
              className="p-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-[#020612] font-bold text-slate-800 dark:text-slate-200 rounded-md border border-slate-200 dark:border-[#142552]">
                      {item.label}
                    </span>
                    {item.isBold && (
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-transparent dark:border-amber-800/60 font-bold px-1.5 py-0.5 rounded">
                        Bold by Default
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={item.templateText}
                    onChange={(e) => handleUpdate(item.id, { templateText: e.target.value })}
                    className="w-full text-xs text-slate-700 dark:text-slate-200 font-medium bg-transparent border-b border-dashed border-slate-200 dark:border-slate-700 focus:border-[#ff2d5f] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={item.isBold}
                    onChange={(e) => handleUpdate(item.id, { isBold: e.target.checked })}
                    className="w-4 h-4 text-[#ff2d5f] rounded border-slate-300 dark:border-slate-700 dark:bg-slate-900 focus:ring-[#ff2d5f]"
                  />
                  <span>Highlight Bold</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                  title="Remove Snippet"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
};
