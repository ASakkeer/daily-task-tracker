import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, AlertCircle, Layers, Tag, Flag, CheckCircle2, User, Milestone, Bookmark, Calendar, CalendarDays } from 'lucide-react';
import { AppMetadata, BacklogItem, BacklogPriority, BacklogStatus, BacklogType } from '../../types';
import { BACKLOG_STATUSES, BACKLOG_TYPES, getPriorityBadge } from '../backlog/backlogConstants';
import { getTodayDateStr } from '../../utils/date';
import { cn } from '../../utils/cn';

interface BacklogItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemData: Omit<BacklogItem, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => void;
  initialItem?: BacklogItem | null;
  metadata: AppMetadata;
}

export const BacklogItemModal: React.FC<BacklogItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  metadata,
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<BacklogType>('feature');
  const [priority, setPriority] = useState<BacklogPriority>('P2');
  const [status, setStatus] = useState<BacklogStatus>('backlog');
  const [targetDate, setTargetDate] = useState<string>('');
  const [completedDate, setCompletedDate] = useState<string>('');
  const [storyPoints, setStoryPoints] = useState<string>('');
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [customOwnerText, setCustomOwnerText] = useState('');
  const [moduleEpic, setModuleEpic] = useState('');
  const [targetSprint, setTargetSprint] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialItem) {
      setTitle(initialItem.title || '');
      setType(initialItem.type || 'feature');
      setPriority(initialItem.priority || 'P2');
      setStatus(initialItem.status || 'backlog');
      setTargetDate(initialItem.targetDate || '');
      setCompletedDate(initialItem.completedDate || '');
      setStoryPoints(initialItem.storyPoints !== undefined ? String(initialItem.storyPoints) : '');
      setSelectedOwnerIds(initialItem.ownerIds || []);
      setCustomOwnerText(initialItem.customOwnerText || '');
      setModuleEpic(initialItem.moduleEpic || '');
      setTargetSprint(initialItem.targetSprint || '');
      setNotes(initialItem.notes || '');
    } else {
      setTitle('');
      setType('feature');
      setPriority('P2');
      setStatus('backlog');
      setTargetDate(getTodayDateStr());
      setCompletedDate('');
      setStoryPoints('');
      setSelectedOwnerIds([]);
      setCustomOwnerText('');
      setModuleEpic(metadata.backlogConfig?.epics?.[0] || '');
      setTargetSprint(metadata.backlogConfig?.defaultSprint || metadata.backlogConfig?.sprints?.[0] || '');
      setNotes('');
    }
    setError(null);
  }, [initialItem, isOpen, metadata]);

  // Handle status toggle to completed
  const handleStatusChange = (newStatus: BacklogStatus) => {
    setStatus(newStatus);
    if (newStatus === 'completed' && !completedDate) {
      setCompletedDate(getTodayDateStr());
    } else if (newStatus !== 'completed' && completedDate) {
      setCompletedDate('');
    }
  };

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e as any);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, title, type, priority, status, storyPoints, selectedOwnerIds, customOwnerText, moduleEpic, targetSprint, notes]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Please provide a title or work item description.');
      return;
    }

    let parsedPoints: number | undefined;
    if (storyPoints.trim()) {
      const p = parseFloat(storyPoints.trim());
      if (isNaN(p) || p < 0 || p > 100) {
        setError('Story points must be a valid number between 0 and 100.');
        return;
      }
      parsedPoints = Math.round(p * 10) / 10;
    }

    onSave({
      title: cleanTitle,
      type,
      priority,
      status,
      targetDate: targetDate.trim() || undefined,
      completedDate: completedDate.trim() || undefined,
      storyPoints: parsedPoints,
      ownerIds: selectedOwnerIds,
      customOwnerText: customOwnerText.trim() || undefined,
      moduleEpic: moduleEpic.trim() || undefined,
      targetSprint: targetSprint.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const epics = metadata.backlogConfig?.epics || [];
  const sprints = metadata.backlogConfig?.sprints || [];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#142552] bg-slate-50/50 dark:bg-[#020612]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-[#ff2d5f]/10 text-[#ff2d5f] border border-rose-200 dark:border-[#ff2d5f]/20">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {initialItem ? 'Edit Backlog Item' : 'New Backlog Work Item'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {initialItem ? 'Update item details, priority, points and target sprint' : 'Add a user story, bug, or technical spike to the product backlog'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-[#08122f] transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-[#ff2d5f]/10 border border-rose-200 dark:border-[#ff2d5f]/30 flex items-center gap-2.5 text-xs text-rose-700 dark:text-[#ff2d5f] font-semibold animate-in shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Item Title / Summary <span className="text-[#ff2d5f]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Implement OAuth 2.0 PKCE authentication flow"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400"
              autoFocus
              required
            />
          </div>

          {/* Type & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-500" />
                Work Item Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as BacklogType)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white"
              >
                {Object.values(BACKLOG_TYPES).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-[#ff2d5f]" />
                Priority (P0 - P3)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['P0', 'P1', 'P2', 'P3'].map((pCode) => {
                  const b = getPriorityBadge(pCode, metadata.backlogConfig?.priorities);
                  const isSelected = (priority || '').toUpperCase().includes(pCode);
                  return (
                    <button
                      key={pCode}
                      type="button"
                      onClick={() => setPriority(pCode)}
                      style={{
                        backgroundColor: isSelected ? b.bgColor : undefined,
                        color: isSelected ? b.color : undefined,
                        borderColor: isSelected ? b.color : undefined,
                      }}
                      className={cn(
                        'py-1.5 px-2 text-xs font-black rounded-xl border text-center transition-all cursor-pointer',
                        isSelected
                          ? 'ring-2 ring-[#ff2d5f]/25 shadow-xs font-black scale-102'
                          : 'bg-slate-50 dark:bg-[#020612] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#142552] hover:border-slate-300 dark:hover:border-slate-700'
                      )}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Target Date & Completed Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#ff2d5f]" />
                  Target Date (Due Date)
                </label>
                <button
                  type="button"
                  onClick={() => setTargetDate(getTodayDateStr())}
                  className="text-[10px] font-bold text-[#ff2d5f] hover:underline cursor-pointer"
                >
                  Set Today
                </button>
              </div>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                  Completed Date
                </label>
                {status === 'completed' && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    Auto-recorded
                  </span>
                )}
              </div>
              <input
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Status & Story Points Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Workflow Status
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as BacklogStatus)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white"
              >
                {Object.values(BACKLOG_STATUSES).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Story Points / Effort
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="e.g. 3, 5, 8"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
          </div>

          {/* Module / Epic & Target Sprint Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                Module / Epic
              </label>
              {epics.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={moduleEpic}
                    onChange={(e) => setModuleEpic(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="">(None / General)</option>
                    {epics.map((epic) => (
                      <option key={epic} value={epic}>
                        {epic}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  type="text"
                  value={moduleEpic}
                  onChange={(e) => setModuleEpic(e.target.value)}
                  placeholder="e.g. Authentication, Billing, Dashboard"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Milestone className="w-3.5 h-3.5 text-indigo-500" />
                Target Sprint / Milestone
              </label>
              {sprints.length > 0 ? (
                <select
                  value={targetSprint}
                  onChange={(e) => setTargetSprint(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white"
                >
                  <option value="">(Unscheduled / Future)</option>
                  {sprints.map((sprint) => (
                    <option key={sprint} value={sprint}>
                      {sprint}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={targetSprint}
                  onChange={(e) => setTargetSprint(e.target.value)}
                  placeholder="e.g. Sprint 24, Q1-Release"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400"
                />
              )}
            </div>
          </div>

          {/* Assignee / Owner */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Assignee / Owner
            </label>
            {metadata.owners && metadata.owners.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-2">
                {metadata.owners.map((owner) => {
                  const isSelected = selectedOwnerIds.includes(owner.id);
                  return (
                    <button
                      key={owner.id}
                      type="button"
                      onClick={() => {
                        setSelectedOwnerIds((prev) =>
                          isSelected ? prev.filter((id) => id !== owner.id) : [...prev, owner.id]
                        );
                      }}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer',
                        isSelected
                          ? 'bg-[#ff2d5f]/15 border-[#ff2d5f] text-[#ff2d5f]'
                          : 'bg-slate-100 dark:bg-[#08122f] border-slate-200 dark:border-[#142552] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: owner.avatarColor || '#ff2d5f' }}
                      />
                      {owner.name}
                      {owner.role && <span className="opacity-60 text-[10px]">({owner.role})</span>}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <input
              type="text"
              value={customOwnerText}
              onChange={(e) => setCustomOwnerText(e.target.value)}
              placeholder="Or enter custom assignee name..."
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          {/* Acceptance Criteria & Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Acceptance Criteria / Implementation Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key criteria, dependencies, technical considerations, or links..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-normal text-slate-900 dark:text-white placeholder-slate-400 resize-none"
            />
          </div>

          {/* Modal Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-[#142552]">
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-[#020612] rounded border text-[10px] font-mono">Ctrl+Enter</kbd> to save
            </span>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#08122f] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-black text-white bg-[#ff2d5f] hover:bg-[#e02653] shadow-md shadow-[#ff2d5f]/20 rounded-xl transition-all cursor-pointer"
              >
                {initialItem ? 'Save Changes' : 'Create Work Item'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
