import React, { useState } from 'react';
import { StudioBranding } from '../../types';
import { Building2, Sparkles, Check, Image as ImageIcon } from 'lucide-react';

interface BrandingManagerProps {
  branding: StudioBranding;
  onChange: (branding: StudioBranding) => void;
}

export const BrandingManager: React.FC<BrandingManagerProps> = ({ branding, onChange }) => {
  const [companyName, setCompanyName] = useState(branding.companyName || 'Daily Task Tracker');
  const [teamTagline, setTeamTagline] = useState(branding.teamTagline || 'Engineering & QA Workspace');
  const [showInExport, setShowInExport] = useState(branding.showInExport ?? true);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange({
      companyName: companyName.trim(),
      teamTagline: teamTagline.trim(),
      showInExport,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-[#ff2d5f]" />
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Team &amp; Studio Branding
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 font-medium">
          Configure company branding and pod identity that appears at the top of exported 3x PNG images and Standup reports.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Company / Department Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp QA Pod"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Team Tagline / Subtitle</label>
            <input
              type="text"
              value={teamTagline}
              onChange={(e) => setTeamTagline(e.target.value)}
              placeholder="e.g. Daily Sprint & Defect Tracking Studio"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showInExport}
                onChange={(e) => setShowInExport(e.target.checked)}
                className="w-4 h-4 text-[#ff2d5f] rounded border-slate-300 dark:border-slate-700 dark:bg-slate-900 focus:ring-[#ff2d5f]"
              />
              <span>Display custom company branding in exported 3x PNG headers</span>
            </label>
          </div>

          <div className="pt-3 flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              Save Branding Settings
            </button>
            {saved && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Live Export Header Preview */}
      <div className="bg-[#020612] p-5 rounded-xl border border-[#142552] text-white shadow-sm space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400">
          <ImageIcon className="w-3.5 h-3.5 text-[#ff2d5f]" />
          Live Header Preview in Exported PNG
        </div>

        <div className="p-4 bg-white text-slate-900 rounded-xl border border-slate-300 shadow-sm flex items-center justify-between">
          <div>
            <h4 className="text-base font-black text-slate-900">
              {companyName || 'Engineering Pod'}
            </h4>
            <span className="text-xs text-slate-500 font-medium">
              {teamTagline || 'Daily Sprint Tracking'} • 14-Nov-2026 (Morning)
            </span>
          </div>

          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-bold uppercase">
            Morning Snapshot
          </span>
        </div>
      </div>
    </div>
  );
};
