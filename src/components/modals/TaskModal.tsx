import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Calendar,
  Bold,
  Layers,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { AppMetadata, TaskRow, CustomStatus } from '../../types';
import { calculateDaysOverdue, getAgingStyle } from '../../utils/aging';
import { DatePickerPopover } from '../common/DatePickerPopover';
import { ColorPickerPopover } from '../common/ColorPickerPopover';
import { CustomDropdown } from '../common/CustomDropdown';
import { cn } from '../../utils/cn';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: TaskRow, newSectionCreated?: string) => void;
  initialTask?: TaskRow | null;
  metadata: AppMetadata;
  activeReportDate: string;
  historicalTaskTitles?: string[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  metadata,
  activeReportDate,
  historicalTaskTitles = [],
}) => {
  const [sectionId, setSectionId] = useState('');
  const [isCreatingNewSection, setIsCreatingNewSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  const [category, setCategory] = useState('');
  const [completionPct, setCompletionPct] = useState(0);
  const [confidencePct, setConfidencePct] = useState(0); // Default 0%
  const [previousCompletionPct, setPreviousCompletionPct] = useState<number | undefined>(undefined);
  const [previousConfidencePct, setPreviousConfidencePct] = useState<number | undefined>(undefined);

  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [customOwnerText, setCustomOwnerText] = useState('');
  const [etaDate, setEtaDate] = useState(activeReportDate);
  const [statusId, setStatusId] = useState('');
  const [isCustomStatus, setIsCustomStatus] = useState(false);
  const [customStatus, setCustomStatus] = useState<CustomStatus>({
    label: '',
    bgColor: '#EDE9FE',
    textColor: '#6D28D9',
  });
  const [notes, setNotes] = useState('');
  const [highlightNotesBold, setHighlightNotesBold] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Suggestions filter
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (initialTask) {
      setSectionId(initialTask.sectionId);
      setCategory(initialTask.category);
      setCompletionPct(initialTask.completionPct);
      setConfidencePct(initialTask.confidencePct ?? 0);
      setPreviousCompletionPct(initialTask.previousCompletionPct);
      setPreviousConfidencePct(initialTask.previousConfidencePct);
      setOwnerIds(initialTask.ownerIds || []);
      setCustomOwnerText(initialTask.customOwnerText || '');
      setEtaDate(initialTask.etaDate || activeReportDate);
      setStatusId(initialTask.statusId);
      if (initialTask.customStatus) {
        setIsCustomStatus(true);
        setCustomStatus(initialTask.customStatus);
      } else {
        setIsCustomStatus(false);
        setCustomStatus({ label: '', bgColor: '#EDE9FE', textColor: '#6D28D9' });
      }
      setNotes(initialTask.notes || '');
      setHighlightNotesBold(initialTask.highlightNotesBold || false);
      setCustomFieldValues(initialTask.customFieldValues || {});
    } else {
      // Default new task
      const defaultSection = metadata.sections[0]?.id || '';
      const defaultStatus = metadata.statuses.find((s) => s.label === 'Not started')?.id || metadata.statuses[0]?.id || '';
      setSectionId(defaultSection);
      setCategory('');
      setCompletionPct(0);
      setConfidencePct(0); // Default 0%
      setPreviousCompletionPct(undefined);
      setPreviousConfidencePct(undefined);
      setOwnerIds([]);
      setCustomOwnerText('');
      setEtaDate(activeReportDate);
      setStatusId(defaultStatus);
      setIsCustomStatus(metadata.statuses.length === 0);
      if (metadata.statuses.length === 0) {
        setCustomStatus({ label: 'In Progress', bgColor: '#E0F2FE', textColor: '#0369A1' });
      }
      setNotes('');
      setHighlightNotesBold(false);
      setCustomFieldValues({});
    }
    setIsCreatingNewSection(metadata.sections.length === 0);
    setNewSectionTitle('');
  }, [initialTask, isOpen, metadata, activeReportDate]);

  // Autocomplete filtering
  useEffect(() => {
    if (!category.trim() || category.length < 2) {
      setFilteredSuggestions([]);
      return;
    }
    const q = category.toLowerCase();
    const matches = Array.from(new Set(historicalTaskTitles))
      .filter((t) => t.toLowerCase().includes(q) && t.toLowerCase() !== q)
      .slice(0, 4);
    setFilteredSuggestions(matches);
  }, [category, historicalTaskTitles]);

  if (!isOpen) return null;

  // Smart Rule: Setting Completion % to 100%
  const handleCompletionChange = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    if (clamped === 100 && completionPct !== 100) {
      setPreviousCompletionPct(completionPct);
      setPreviousConfidencePct(confidencePct);
      setConfidencePct(100);
      const completedStatus = metadata.statuses.find((s) => s.isCompletedState);
      if (completedStatus) {
        setStatusId(completedStatus.id);
        setIsCustomStatus(false);
      }
    } else if (clamped < 100 && completionPct === 100) {
      // If dropping down from 100%, restore status if it was completed
      const completedStatus = metadata.statuses.find((s) => s.isCompletedState);
      if (completedStatus && statusId === completedStatus.id) {
        const inProg = metadata.statuses.find((s) => s.label.toLowerCase().includes('progress')) || metadata.statuses[0];
        if (inProg) setStatusId(inProg.id);
      }
    }
    setCompletionPct(clamped);
  };

  const handleConfidenceChange = (pct: number) => {
    setConfidencePct(Math.max(0, Math.min(100, pct)));
  };

  // Status Change with persistence of previous values
  const handleStatusChange = (newStatusId: string) => {
    if (newStatusId === '__other__') {
      setIsCustomStatus(true);
      return;
    }
    setIsCustomStatus(false);
    const targetStatus = metadata.statuses.find((s) => s.id === newStatusId);
    const isTargetComp = targetStatus?.isCompletedState ?? false;
    const currentStatusConfig = metadata.statuses.find((s) => s.id === statusId);
    const wasComp = currentStatusConfig?.isCompletedState ?? false;

    if (isTargetComp && !wasComp) {
      // Remember previous values before switching to completed
      setPreviousCompletionPct(completionPct);
      setPreviousConfidencePct(confidencePct);
      setCompletionPct(100);
      setConfidencePct(100);
    } else if (!isTargetComp && wasComp) {
      // Restore previous user values
      setCompletionPct(previousCompletionPct !== undefined ? previousCompletionPct : 0);
      setConfidencePct(previousConfidencePct !== undefined ? previousConfidencePct : 0);
    }
    setStatusId(newStatusId);
  };

  const handleOwnerToggle = (id: string) => {
    setOwnerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleApplySnippet = (snippetText: string, isBoldTemplate: boolean) => {
    setNotes((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}; ${snippetText}` : snippetText;
    });
    if (isBoldTemplate) {
      setHighlightNotesBold(true);
    }
  };

  // Days overdue calculation for live preview badge
  const daysOverdue = calculateDaysOverdue(etaDate, activeReportDate);
  const isCompleted = completionPct === 100 || metadata.statuses.find((s) => s.id === statusId)?.isCompletedState || false;
  const agingBadgeStyle = getAgingStyle(daysOverdue, isCompleted, metadata.agingRules);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim()) return;

    let targetSectionId = sectionId;
    let newlyCreatedSectionTitle: string | undefined;

    if (isCreatingNewSection && newSectionTitle.trim()) {
      targetSectionId = `sec_${Date.now()}`;
      newlyCreatedSectionTitle = newSectionTitle.trim();
    }

    const taskToSave: TaskRow = {
      id: initialTask?.id || `task_${Date.now()}`,
      sectionId: targetSectionId,
      order: initialTask?.order || 9999,
      category: category.trim(),
      completionPct,
      confidencePct,
      previousCompletionPct,
      previousConfidencePct,
      ownerIds,
      customOwnerText: customOwnerText.trim() || undefined,
      etaDate,
      statusId: isCustomStatus ? 'status_custom' : statusId,
      customStatus: isCustomStatus && customStatus.label.trim() ? customStatus : undefined,
      notes: notes.trim(),
      highlightNotesBold,
      customFieldValues: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
    };

    onSave(taskToSave, newlyCreatedSectionTitle);
    onClose();
  };

  const activeStatusConfig = metadata.statuses.find((s) => s.id === statusId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-[#050c21] w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-[#142552] overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#020612] border-b border-slate-200 dark:border-[#142552] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ff2d5f] text-white flex items-center justify-center font-black text-sm shadow-md shadow-[#ff2d5f]/25">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {initialTask ? 'Edit Task Plan' : 'Add New Task Plan'}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Report Date Context: <strong className="text-slate-700 dark:text-slate-200">{activeReportDate}</strong>
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

        {/* Modal Scrollable Body */}
        <form id="task-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 1. Section Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-600 dark:text-[#ff2d5f]" />
                Section Divider
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNewSection(!isCreatingNewSection)}
                className="text-xs text-rose-600 dark:text-[#ff2d5f] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                {isCreatingNewSection ? 'Choose Existing' : '+ New Section'}
              </button>
            </div>

            {isCreatingNewSection ? (
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="Enter new section name (e.g. Infrastructure, Core Engine)..."
                className="w-full px-3 py-2 text-xs bg-rose-50/50 dark:bg-[#020612] border border-rose-300 dark:border-[#ff2d5f]/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-slate-900 dark:text-slate-100 font-semibold"
                required
                autoFocus
              />
            ) : (
              <CustomDropdown
                value={sectionId}
                onChange={setSectionId}
                options={
                  metadata.sections.length > 0
                    ? metadata.sections.map((sec) => ({
                        value: sec.id,
                        label: `${sec.title}${sec.isBugSection ? ' (Bugs)' : ''}`,
                      }))
                    : [{ value: '', label: 'General Tasks (or click + New Section above)' }]
                }
                className="w-full text-xs"
                buttonClassName="py-2 px-3 text-xs font-semibold"
              />
            )}
          </div>

          {/* 2. Task Description (Textarea enlarged for usability, no AI button) */}
          <div className="relative">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Task Description / Title <span className="text-rose-500">*</span>
            </label>

            <textarea
              rows={3}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="e.g. Implement authentication token refresh flow & session verification test cases..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed font-medium"
              required
            />

            {/* Smart Autocomplete dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 z-30 mt-1 bg-white dark:bg-[#050c21] border border-slate-200 dark:border-[#142552] rounded-xl shadow-2xl overflow-hidden">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 bg-slate-50 dark:bg-[#020612] border-b border-slate-100 dark:border-[#142552]">
                  Suggestions from past tasks:
                </div>
                {filteredSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setCategory(sug);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-[#ff2d5f]/15 hover:text-rose-900 dark:hover:text-[#ff2d5f] truncate block border-b border-slate-100 dark:border-[#142552] last:border-0 cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Status & ETA (Side by Side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Status
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CustomDropdown
                    value={isCustomStatus ? '__other__' : statusId}
                    onChange={handleStatusChange}
                    options={[
                      ...metadata.statuses.map((st) => ({
                        value: st.id,
                        label: `${st.label}${st.isCompletedState ? ' (Completed)' : ''}`,
                        color: st.bgColor,
                        textColor: st.textColor,
                      })),
                      { value: '__other__', label: 'Other / Custom Status...' },
                    ]}
                    className="w-full text-xs"
                    buttonClassName="py-2 px-3 text-xs font-semibold"
                  />
                </div>
                {!isCustomStatus && activeStatusConfig && (
                  <span
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs flex-shrink-0"
                    style={{ backgroundColor: activeStatusConfig.bgColor, color: activeStatusConfig.textColor }}
                  >
                    {activeStatusConfig.label}
                  </span>
                )}
              </div>

              {/* Custom Status Editor */}
              {isCustomStatus && (
                <div className="mt-2 p-3 bg-rose-50/50 dark:bg-[#020612] border border-rose-200 dark:border-[#ff2d5f]/30 rounded-xl space-y-2 animate-in fade-in">
                  <input
                    type="text"
                    value={customStatus.label}
                    onChange={(e) => setCustomStatus({ ...customStatus, label: e.target.value })}
                    placeholder="Enter custom status name..."
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#050c21] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f]"
                    required={isCustomStatus}
                  />
                  <div className="flex items-center gap-2">
                    <ColorPickerPopover
                      label="Bg:"
                      color={customStatus.bgColor}
                      onChange={(c) => setCustomStatus({ ...customStatus, bgColor: c })}
                    />
                    <ColorPickerPopover
                      label="Text:"
                      color={customStatus.textColor}
                      onChange={(c) => setCustomStatus({ ...customStatus, textColor: c })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Target ETA Date */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-600 dark:text-[#ff2d5f]" />
                  Target ETA Date
                </span>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded-md"
                  style={{
                    backgroundColor: agingBadgeStyle.bgColor,
                    color: agingBadgeStyle.textColor,
                  }}
                >
                  {daysOverdue === 0 ? 'On Time' : `${daysOverdue}d Overdue`}
                </span>
              </label>
              <DatePickerPopover
                value={etaDate}
                onChange={setEtaDate}
                className="w-full"
                buttonClassName="w-full justify-start py-2 text-xs font-bold"
              />
            </div>
          </div>

          {/* 4. Progress Tracking (Completion % & Confidence %) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 dark:bg-[#020612] rounded-xl border border-slate-200 dark:border-[#142552]">
            {/* Completion % */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Completion %</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={completionPct}
                    onChange={(e) => handleCompletionChange(Number(e.target.value))}
                    className="w-14 px-1.5 py-0.5 text-xs font-bold text-center bg-white dark:bg-[#050c21] border border-slate-300 dark:border-[#142552] rounded focus:ring-1 focus:ring-[#ff2d5f] focus:outline-none font-mono"
                  />
                  <span className="text-xs text-slate-500 font-bold">%</span>
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                value={completionPct}
                onChange={(e) => handleCompletionChange(Number(e.target.value))}
                className="w-full accent-[#ff2d5f] cursor-pointer"
              />

              <div className="flex items-center gap-1 pt-0.5">
                {[0, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleCompletionChange(val)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer',
                      completionPct === val
                        ? 'bg-[#ff2d5f] text-white border-[#ff2d5f]'
                        : 'bg-white dark:bg-[#050c21] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-[#142552] hover:border-[#ff2d5f]'
                    )}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence % (Default 0%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confidence %</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={confidencePct}
                    onChange={(e) => handleConfidenceChange(Number(e.target.value))}
                    className="w-14 px-1.5 py-0.5 text-xs font-bold text-center bg-white dark:bg-[#050c21] border border-slate-300 dark:border-[#142552] rounded focus:ring-1 focus:ring-[#ff2d5f] focus:outline-none font-mono"
                  />
                  <span className="text-xs text-slate-500 font-bold">%</span>
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                value={confidencePct}
                onChange={(e) => handleConfidenceChange(Number(e.target.value))}
                className="w-full accent-[#ff2d5f] cursor-pointer"
              />

              <div className="flex items-center gap-1 pt-0.5">
                {[0, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleConfidenceChange(val)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer',
                      confidencePct === val
                        ? 'bg-[#ff2d5f] text-white border-[#ff2d5f]'
                        : 'bg-white dark:bg-[#050c21] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-[#142552] hover:border-[#ff2d5f]'
                    )}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Owner Assignment */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-rose-600 dark:text-[#ff2d5f]" />
              Owner Assignment
            </label>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {metadata.owners.map((owner) => {
                const isSelected = ownerIds.includes(owner.id);
                return (
                  <button
                    key={owner.id}
                    type="button"
                    onClick={() => handleOwnerToggle(owner.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer',
                      isSelected
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-[#020612] border-slate-900 dark:border-white shadow-xs'
                        : 'bg-white dark:bg-[#020612] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#142552] hover:border-[#ff2d5f]'
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: owner.avatarColor }}
                    />
                    <span>{owner.name}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={customOwnerText}
              onChange={(e) => setCustomOwnerText(e.target.value)}
              placeholder="Or free-text custom owner (e.g. External Contractor)..."
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-medium placeholder-slate-400"
            />
          </div>

          {/* 6. Blockers / Notes (Enlarged textarea + dynamic snippets) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Blockers / Notes
              </label>

              <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={highlightNotesBold}
                  onChange={(e) => setHighlightNotesBold(e.target.checked)}
                  className="w-3.5 h-3.5 text-[#ff2d5f] rounded border-slate-300 dark:border-[#142552] focus:ring-[#ff2d5f]"
                />
                <Bold className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <span>Bold in Export</span>
              </label>
            </div>

            {/* Note Snippets */}
            {metadata.noteTemplates.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-[10px] font-bold text-slate-400 self-center mr-1">
                  Quick Insert:
                </span>
                {metadata.noteTemplates.map((snippet) => (
                  <button
                    key={snippet.id}
                    type="button"
                    onClick={() => handleApplySnippet(snippet.templateText, snippet.isBold)}
                    className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-[#08122f] hover:bg-slate-200 dark:hover:bg-[#0c1a40] text-slate-700 dark:text-slate-300 font-bold rounded-md border border-slate-200 dark:border-[#142552] transition-colors cursor-pointer"
                    title={snippet.templateText}
                  >
                    + {snippet.label}
                  </button>
                ))}
              </div>
            )}

            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Blocked by backend staging deploy; awaiting test sign-off..."
              className={cn(
                'w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed',
                highlightNotesBold ? 'font-bold text-slate-950 dark:text-white' : 'font-medium'
              )}
            />
          </div>

          {/* 7. Dynamic Custom Columns (if configured) */}
          {(() => {
            const customCols = (metadata.columns || []).filter((c) => c.isCustom && c.visible);
            if (customCols.length === 0) return null;
            return (
              <div className="p-3.5 bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-xl space-y-2.5 animate-in fade-in">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Dynamic Custom Columns ({customCols.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customCols.map((col) => (
                    <div key={col.id} className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>{col.customLabel || col.defaultLabel}</span>
                        {col.type && (
                          <span className="text-[10px] uppercase font-mono text-rose-600 dark:text-[#ff2d5f] font-bold">
                            {col.type}
                          </span>
                        )}
                      </label>
                      <input
                        type={col.type === 'number' ? 'number' : col.type === 'link' ? 'url' : 'text'}
                        value={customFieldValues[col.key] || ''}
                        onChange={(e) =>
                          setCustomFieldValues((prev) => ({
                            ...prev,
                            [col.key]: e.target.value,
                          }))
                        }
                        placeholder={
                          col.type === 'link'
                            ? 'https://...'
                            : col.type === 'number'
                            ? '0'
                            : col.type === 'tag'
                            ? 'e.g. Frontend, P1'
                            : `Enter ${col.customLabel || col.defaultLabel}...`
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#050c21] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-slate-900 dark:text-slate-100 placeholder-slate-400 font-medium"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </form>

        {/* 8. Sticky Bottom Actions (ALWAYS Visible) */}
        <div className="sticky bottom-0 z-20 px-6 py-3.5 bg-white/95 dark:bg-[#050c21]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#142552] flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#08122f] rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="task-modal-form"
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-xl text-xs font-black shadow-md shadow-[#ff2d5f]/25 hover:shadow-[0_0_16px_rgba(255,45,95,0.45)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{initialTask ? 'Update Task' : 'Add to Report'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
