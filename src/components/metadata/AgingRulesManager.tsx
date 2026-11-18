import React, { useState } from 'react';
import { AgingRulesConfig, AgingThreshold } from '../../types';
import {
  Clock,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Calendar,
  ShieldCheck,
  Bold,
} from 'lucide-react';
import { ColorPickerPopover } from '../common/ColorPickerPopover';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { getAgingStyle, DEFAULT_AGING_RULES } from '../../utils/aging';

interface AgingRulesManagerProps {
  agingRules: AgingRulesConfig;
  onChange: (rules: AgingRulesConfig) => void;
}

export const AgingRulesManager: React.FC<AgingRulesManagerProps> = ({ agingRules, onChange }) => {
  const [testDays, setTestDays] = useState(3);
  const [testCompleted, setTestCompleted] = useState(false);

  // New threshold form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMinDays, setNewMinDays] = useState<number>(1);
  const [newMaxDays, setNewMaxDays] = useState<number | null>(3);
  const [hasNoMax, setHasNoMax] = useState(false);
  const [newBgColor, setNewBgColor] = useState('#FEE2E2');
  const [newTextColor, setNewTextColor] = useState('#991B1B');
  const [newIsBold, setNewIsBold] = useState(true);

  // Confirmation modal state
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

  const handleUpdateThreshold = (id: string, updates: Partial<AgingThreshold>) => {
    const updated = agingRules.thresholds.map((t) => (t.id === id ? { ...t, ...updates } : t));
    onChange({ ...agingRules, thresholds: updated });
  };

  const handleToggleFreeze = (freeze: boolean) => {
    onChange({ ...agingRules, freezeAgingOnComplete: freeze });
  };

  const handleToggleExcludeWeekends = (exclude: boolean) => {
    onChange({ ...agingRules, excludeWeekends: exclude });
  };

  const handleGracePeriodChange = (days: number) => {
    const safeDays = Math.max(0, Math.min(30, isNaN(days) ? 0 : days));
    onChange({ ...agingRules, gracePeriodDays: safeDays });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= agingRules.thresholds.length) return;
    const items = [...agingRules.thresholds];
    const [moved] = items.splice(index, 1);
    items.splice(newIdx, 0, moved);
    onChange({ ...agingRules, thresholds: items });
  };

  const handleDeleteThreshold = (id: string) => {
    if (agingRules.thresholds.length <= 1) {
      setConfirmModal({
        isOpen: true,
        title: 'Aging Rule Requirement',
        message: 'You must maintain at least one aging threshold rule to prevent styling errors in reports.',
        confirmText: 'Understood',
        variant: 'warning',
        isAlertOnly: true,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const target = agingRules.thresholds.find((t) => t.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Aging Threshold',
      message: `Are you sure you want to remove the threshold "${target?.label}"? Tasks within this day range will fall back to default colors.`,
      confirmText: 'Delete Rule',
      variant: 'danger',
      isAlertOnly: false,
      onConfirm: () => {
        const filtered = agingRules.thresholds.filter((t) => t.id !== id);
        onChange({ ...agingRules, thresholds: filtered });
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleResetDefaults = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Restore Default Aging Rules',
      message: 'Are you sure you want to restore the standard engineering aging thresholds (On Track, 1-2d Overdue, 3-4d Overdue, 5+d Overdue)? Custom color scales will be reset.',
      confirmText: 'Restore Defaults',
      variant: 'warning',
      isAlertOnly: false,
      onConfirm: () => {
        onChange({
          ...DEFAULT_AGING_RULES,
        });
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleCreateThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const newThreshold: AgingThreshold = {
      id: `aging_${Date.now()}`,
      label: newLabel.trim(),
      minDays: Math.max(0, newMinDays),
      maxDays: hasNoMax ? null : Math.max(newMinDays, newMaxDays ?? newMinDays),
      bgColor: newBgColor,
      textColor: newTextColor,
      isBold: newIsBold,
    };

    onChange({
      ...agingRules,
      thresholds: [...agingRules.thresholds, newThreshold],
    });

    setNewLabel('');
    setNewMinDays(1);
    setNewMaxDays(3);
    setHasNoMax(false);
    setNewBgColor('#FEE2E2');
    setNewTextColor('#991B1B');
    setNewIsBold(true);
    setIsAddingNew(false);
  };

  const effectiveTestDays = Math.max(0, testDays - (agingRules.gracePeriodDays || 0));
  const previewStyle = getAgingStyle(effectiveTestDays, testCompleted, agingRules);

  return (
    <div className="space-y-6">
      {/* Confirmation Modal */}
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

      {/* Relevant Options Card */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl space-y-5 transition-colors">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-[#142552]/50">
          <Clock className="w-4 h-4 text-[#ff2d5f]" />
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            ETA Aging &amp; Overdue Evaluation Rules
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Policy: Freeze Overdue */}
          <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552]">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldAlert className="w-4 h-4 text-[#ff2d5f]" />
                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">
                  Completed Task Aging
                </h4>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                Choose whether finished tasks retain their historical overdue red heatmaps or turn mint green.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-[#142552]/60 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {agingRules.freezeAgingOnComplete ? 'Freeze Overdue' : 'Turn Mint Green'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={agingRules.freezeAgingOnComplete}
                  onChange={(e) => handleToggleFreeze(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff2d5f]"></div>
              </label>
            </div>
          </div>

          {/* Policy: Exclude Weekends */}
          <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552]">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Calendar className="w-4 h-4 text-[#ff2d5f]" />
                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">
                  Business Days Only
                </h4>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                Exclude Saturday &amp; Sunday from overdue calculations. Tasks due on Friday will be 1 business day overdue on Monday.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-[#142552]/60 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {agingRules.excludeWeekends ? 'Skip Weekends (Active)' : 'Include Weekends'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={agingRules.excludeWeekends ?? false}
                  onChange={(e) => handleToggleExcludeWeekends(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff2d5f]"></div>
              </label>
            </div>
          </div>

          {/* Policy: Grace Period */}
          <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552]">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-[#ff2d5f]" />
                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase">
                  Overdue Grace Period
                </h4>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                Allow a safety buffer in days before overdue styling and heatmap alerts trigger in the report.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-[#142552]/60 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Grace Buffer:
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="14"
                  value={agingRules.gracePeriodDays ?? 0}
                  onChange={(e) => handleGracePeriodChange(parseInt(e.target.value, 10))}
                  className="w-16 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-[#050c21] border border-slate-300 dark:border-[#142552] rounded-lg text-center text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ff2d5f]"
                />
                <span className="text-xs font-semibold text-slate-500">days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Interactive Preview Tester */}
      <div className="bg-[#020612] text-white p-5 rounded-xl border border-[#142552] shadow-md">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
          <Sparkles className="w-4 h-4 text-[#ff2d5f] animate-pulse" />
          Interactive Aging Heatmap Live Simulator
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <div className="flex justify-between text-xs text-slate-300 font-semibold">
              <span>
                Simulate Raw Overdue Days:{' '}
                <strong className="text-white text-sm font-mono font-black">{testDays} days</strong>
                {(agingRules.gracePeriodDays ?? 0) > 0 && (
                  <span className="text-[#ff2d5f] ml-2 text-[11px]">
                    (Effective: {effectiveTestDays}d after {agingRules.gracePeriodDays}d grace)
                  </span>
                )}
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={testCompleted}
                  onChange={(e) => setTestCompleted(e.target.checked)}
                  className="rounded text-[#ff2d5f] focus:ring-0"
                />
                <span className="text-slate-300">Mark Task as Completed</span>
              </label>
            </div>
            <input
              type="range"
              min={0}
              max={14}
              value={testDays}
              onChange={(e) => setTestDays(Number(e.target.value))}
              className="w-full accent-[#ff2d5f] cursor-pointer"
            />
          </div>

          <div className="md:col-span-4 flex justify-center">
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block mb-1 font-bold">Rendered Cell Preview</span>
              <div
                className="px-4 py-2 rounded border text-xs font-bold shadow-md transition-all duration-200"
                style={{
                  backgroundColor: previewStyle.bgColor,
                  color: previewStyle.textColor,
                  fontWeight: previewStyle.isBold ? '700' : '600',
                }}
              >
                {testCompleted && !agingRules.freezeAgingOnComplete ? (
                  <span className="flex items-center gap-1 justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Done (Completed)
                  </span>
                ) : effectiveTestDays === 0 ? (
                  'On Track (0d)'
                ) : (
                  `+${effectiveTestDays}d Overdue (${previewStyle.textColor ? 'Triggered' : ''})`
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thresholds CRUD Table Card */}
      <div className="bg-white dark:bg-[#050c21] rounded-xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="p-4 bg-slate-50/80 dark:bg-[#020612]/70 border-b border-slate-200 dark:border-[#142552] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Configured Aging Heatmap Thresholds ({agingRules.thresholds.length})
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Thresholds evaluate in order from top to bottom. Customize day limits, colors, and font styles.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-[#08122f] hover:bg-slate-200 dark:hover:bg-[#0c1a40] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#142552] rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isAddingNew ? 'Close Form' : '+ Add Threshold'}</span>
            </button>
          </div>
        </div>

        {/* Add New Threshold Form */}
        {isAddingNew && (
          <form
            onSubmit={handleCreateThreshold}
            className="p-4 bg-rose-50/60 dark:bg-[#040e24] border-b border-rose-100 dark:border-[#142552] animate-in fade-in space-y-4"
          >
            <div className="text-xs font-black uppercase text-rose-950 dark:text-[#ff2d5f]">
              Create New Overdue Rule
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Threshold Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical 6-8 Days Lag"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-slate-900 dark:text-white font-semibold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Min Days
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newMinDays}
                  onChange={(e) => setNewMinDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Max Days
                </label>
                {hasNoMax ? (
                  <span className="inline-block py-1.5 text-xs font-mono font-bold text-slate-400">
                    &infin; (No limit)
                  </span>
                ) : (
                  <input
                    type="number"
                    min={newMinDays}
                    required
                    value={newMaxDays ?? newMinDays}
                    onChange={(e) => setNewMaxDays(parseInt(e.target.value, 10) || newMinDays)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-slate-900 dark:text-white font-mono font-bold"
                  />
                )}
              </div>

              <div className="sm:col-span-2 flex items-center h-8">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={hasNoMax}
                    onChange={(e) => setHasNoMax(e.target.checked)}
                    className="rounded text-[#ff2d5f] focus:ring-0"
                  />
                  <span>No Limit (+)</span>
                </label>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newIsBold}
                    onChange={(e) => setNewIsBold(e.target.checked)}
                    className="rounded text-[#ff2d5f] focus:ring-0"
                  />
                  <span>Bold Font</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4">
                <ColorPickerPopover
                  label="Background:"
                  color={newBgColor}
                  onChange={setNewBgColor}
                />
                <ColorPickerPopover
                  label="Text Color:"
                  color={newTextColor}
                  onChange={setNewTextColor}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-black bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg shadow-md cursor-pointer"
                >
                  Save New Rule
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Existing Thresholds List */}
        <div className="divide-y divide-slate-100 dark:divide-[#142552]/40">
          {agingRules.thresholds.map((t, index) => (
            <div
              key={t.id}
              className="p-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Reorder Buttons */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                    title="Move Higher Priority"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === agingRules.thresholds.length - 1}
                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                    title="Move Lower Priority"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Styled Badge Preview */}
                <span
                  className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 min-w-[120px] text-center"
                  style={{
                    backgroundColor: t.bgColor,
                    color: t.textColor,
                    fontWeight: t.isBold ? '700' : '500',
                  }}
                >
                  {t.label}
                </span>

                {/* Inline Editable Fields */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={t.label}
                    onChange={(e) => handleUpdateThreshold(t.id, { label: e.target.value })}
                    className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-[#ff2d5f] focus:outline-none px-1 py-0.5"
                    title="Edit Label"
                  />

                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    <input
                      type="number"
                      min="0"
                      value={t.minDays}
                      onChange={(e) =>
                        handleUpdateThreshold(t.id, { minDays: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-12 px-1 text-center bg-transparent border border-slate-300 dark:border-[#142552] rounded text-slate-800 dark:text-slate-200"
                    />
                    <span>to</span>
                    {t.maxDays === null ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateThreshold(t.id, { maxDays: t.minDays + 2 })}
                        className="text-[11px] px-1 text-rose-600 dark:text-[#ff2d5f] hover:underline cursor-pointer"
                        title="Click to set an upper cap"
                      >
                        &infin; (+)
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={t.minDays}
                          value={t.maxDays}
                          onChange={(e) =>
                            handleUpdateThreshold(t.id, {
                              maxDays: parseInt(e.target.value, 10) || t.minDays,
                            })
                          }
                          className="w-12 px-1 text-center bg-transparent border border-slate-300 dark:border-[#142552] rounded text-slate-800 dark:text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateThreshold(t.id, { maxDays: null })}
                          className="text-[10px] text-slate-400 hover:text-slate-600"
                          title="Remove upper cap (make infinite +)"
                        >
                          &times;
                        </button>
                      </div>
                    )}
                    <span>days</span>
                  </div>
                </div>
              </div>

              {/* Color Controls + Bold + Delete */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdateThreshold(t.id, { isBold: !t.isBold })}
                  className={`p-1.5 rounded text-xs font-black transition-colors ${
                    t.isBold
                      ? 'bg-rose-100 dark:bg-[#ff2d5f]/20 text-rose-900 dark:text-[#ff2d5f]'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={t.isBold ? 'Bold Active' : 'Normal Font Weight'}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>

                <ColorPickerPopover
                  label="Bg:"
                  color={t.bgColor}
                  onChange={(c) => handleUpdateThreshold(t.id, { bgColor: c })}
                />
                <ColorPickerPopover
                  label="Text:"
                  color={t.textColor}
                  onChange={(c) => handleUpdateThreshold(t.id, { textColor: c })}
                />

                <button
                  type="button"
                  onClick={() => handleDeleteThreshold(t.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                  title="Delete Threshold Rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
