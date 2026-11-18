import React, { useState } from 'react';
import { BacklogConfig } from '../../types';
import { Layers, Milestone, Plus, Trash2, Check, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';

interface BacklogSettingsManagerProps {
  config?: BacklogConfig;
  onChange: (config: BacklogConfig) => void;
}

export const BacklogSettingsManager: React.FC<BacklogSettingsManagerProps> = ({
  config = { epics: [], sprints: [], defaultSprint: '' },
  onChange,
}) => {
  const [epics, setEpics] = useState<string[]>(config.epics || []);
  const [sprints, setSprints] = useState<string[]>(config.sprints || []);
  const [defaultSprint, setDefaultSprint] = useState<string>(config.defaultSprint || '');

  const [newEpic, setNewEpic] = useState('');
  const [newSprint, setNewSprint] = useState('');
  const [saved, setSaved] = useState(false);

  const handleAddEpic = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEpic.trim();
    if (!clean) return;
    if (epics.some((ep) => ep.toLowerCase() === clean.toLowerCase())) {
      return;
    }
    const updated = [...epics, clean];
    setEpics(updated);
    setNewEpic('');
    notifyChange(updated, sprints, defaultSprint);
  };

  const handleRemoveEpic = (index: number) => {
    const updated = epics.filter((_, i) => i !== index);
    setEpics(updated);
    notifyChange(updated, sprints, defaultSprint);
  };

  const handleAddSprint = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSprint.trim();
    if (!clean) return;
    if (sprints.some((sp) => sp.toLowerCase() === clean.toLowerCase())) {
      return;
    }
    const updated = [...sprints, clean];
    setSprints(updated);
    setNewSprint('');
    const newDefault = defaultSprint || clean;
    setDefaultSprint(newDefault);
    notifyChange(epics, updated, newDefault);
  };

  const handleRemoveSprint = (index: number) => {
    const removedName = sprints[index];
    const updated = sprints.filter((_, i) => i !== index);
    setSprints(updated);
    const newDefault = defaultSprint === removedName ? (updated[0] || '') : defaultSprint;
    setDefaultSprint(newDefault);
    notifyChange(epics, updated, newDefault);
  };

  const handleDefaultSprintChange = (val: string) => {
    setDefaultSprint(val);
    notifyChange(epics, sprints, val);
  };

  const notifyChange = (newEpics: string[], newSprints: string[], newDefSprint: string) => {
    onChange({
      epics: newEpics,
      sprints: newSprints,
      defaultSprint: newDefSprint,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Epics / Modules Card */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#ff2d5f]" />
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
              Epics &amp; Functional Modules
            </h3>
          </div>
          {saved && (
            <span className="text-xs text-emerald-500 font-bold flex items-center gap-1 animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 font-medium">
          Define functional modules, features, or epics for categorizing backlog items.
        </p>

        {/* Add Epic Form */}
        <form onSubmit={handleAddEpic} className="flex gap-2 max-w-md mb-4">
          <input
            type="text"
            value={newEpic}
            onChange={(e) => setNewEpic(e.target.value)}
            placeholder="e.g. Authentication, Core Engine, Billing"
            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#ff2d5f] hover:bg-[#e02653] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Module</span>
          </button>
        </form>

        {/* Epic Chips */}
        {epics.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#08122f] border border-dashed border-slate-200 dark:border-[#142552] text-center text-xs text-slate-400">
            No epics configured. Backlog work items can be categorized freely or add modules above.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {epics.map((epic, index) => (
              <span
                key={epic}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-500/20"
              >
                <span>{epic}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveEpic(index)}
                  className="text-blue-400 hover:text-rose-500 cursor-pointer"
                  title="Remove Module"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sprint Cycles & Milestones Card */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center gap-2 mb-1">
          <Milestone className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Sprint Cycles &amp; Release Milestones
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 font-medium">
          Configure active sprint cycles (e.g. Sprint 24, Sprint 25) and set the default sprint for new work items.
        </p>

        {/* Add Sprint Form */}
        <form onSubmit={handleAddSprint} className="flex gap-2 max-w-md mb-4">
          <input
            type="text"
            value={newSprint}
            onChange={(e) => setNewSprint(e.target.value)}
            placeholder="e.g. Sprint 24, Q1 Milestone, v2.1-Release"
            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sprint</span>
          </button>
        </form>

        {/* Default Sprint Selector */}
        {sprints.length > 0 && (
          <div className="max-w-xs mb-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Active / Default Sprint:
            </label>
            <select
              value={defaultSprint}
              onChange={(e) => handleDefaultSprintChange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ff2d5f]"
            >
              <option value="">(None)</option>
              {sprints.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sprint Chips */}
        {sprints.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#08122f] border border-dashed border-slate-200 dark:border-[#142552] text-center text-xs text-slate-400">
            No sprint cycles configured. Add sprints above to plan work item iterations.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sprints.map((sprint, index) => (
              <span
                key={sprint}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border',
                  defaultSprint === sprint
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30 ring-1 ring-indigo-500/20'
                    : 'bg-slate-100 dark:bg-[#08122f] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#142552]'
                )}
              >
                <span>{sprint}</span>
                {defaultSprint === sprint && (
                  <span className="text-[10px] uppercase tracking-wider bg-indigo-600 text-white px-1.5 py-0.2 rounded font-black">
                    Default
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveSprint(index)}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
                  title="Remove Sprint"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
