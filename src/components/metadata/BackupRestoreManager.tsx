import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Database,
  ShieldCheck,
  Sliders,
  FileSpreadsheet,
  Layers,
  History,
  FileJson,
  Milestone,
} from 'lucide-react';
import {
  exportDatabaseToJson,
  importDatabaseFromJson,
  exportStudioCustomizationToJson,
  importStudioCustomizationFromJson,
  exportReportBuilderTasksToJson,
  importReportBuilderTasksFromJson,
  exportBacklogToJson,
  importBacklogFromJson,
  resetDatabaseToDefault,
  db,
} from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface BackupRestoreManagerProps {
  onRefreshNeeded: () => void;
}

export const BackupRestoreManager: React.FC<BackupRestoreManagerProps> = ({ onRefreshNeeded }) => {
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Hidden file input refs for each dedicated upload stream
  const customizationInputRef = useRef<HTMLInputElement>(null);
  const tasksInputRef = useRef<HTMLInputElement>(null);
  const backlogInputRef = useRef<HTMLInputElement>(null);
  const fullWorkspaceInputRef = useRef<HTMLInputElement>(null);

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

  // Reactive DB queries
  const metadata = useLiveQuery(() => db.metadata.get('current_metadata'));
  const reportCount = useLiveQuery(() => db.reports.count()) ?? 0;
  const allReports = useLiveQuery(() => db.reports.toArray()) ?? [];
  const auditLogsCount = useLiveQuery(() => db.auditLogs.count()) ?? 0;
  const backlogItemsCount = useLiveQuery(() => db.backlogItems.count()) ?? 0;
  const totalTasks = allReports.reduce((acc, r) => acc + (r.tasks?.length || 0), 0);

  const statusesCount = metadata?.statuses?.length || 0;
  const ownersCount = metadata?.owners?.length || 0;
  const sectionsCount = metadata?.sections?.length || 0;
  const noteTemplatesCount = metadata?.noteTemplates?.length || 0;

  // Browser download helper
  const triggerDownload = (filename: string, jsonString: string) => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFormattedDate = () => new Date().toISOString().split('T')[0];

  // 1. Studio Customization Backup & Restore
  const handleExportCustomization = async () => {
    try {
      setIsProcessing(true);
      const json = await exportStudioCustomizationToJson();
      const filename = `Daily-Task-Tracker-Studio-Customization-${getFormattedDate()}.json`;
      triggerDownload(filename, json);
      setStatusMessage({
        type: 'success',
        text: `Studio Customization exported successfully (${statusesCount} statuses, ${ownersCount} team members, ${sectionsCount} sections).`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Customization export failed: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomizationFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const targetMeta = parsed.metadata || parsed;

      if (!targetMeta || !Array.isArray(targetMeta.statuses) || !Array.isArray(targetMeta.owners)) {
        setStatusMessage({
          type: 'error',
          text: 'Selected file is not a valid Studio Customization backup (missing statuses or team members schema).',
        });
        e.target.value = '';
        return;
      }

      const summary = `${targetMeta.statuses.length} statuses, ${targetMeta.owners.length} team members, ${targetMeta.sections?.length || 0} sections`;

      setConfirmModal({
        isOpen: true,
        title: 'Restore Studio Customization?',
        message: `Restore Studio Customization from "${file.name}" (${summary})? This will update your statuses, team members, sections, note templates, aging rules, and columns. All tasks and reports will remain untouched.`,
        confirmText: 'Restore Customization',
        variant: 'warning',
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          try {
            setIsProcessing(true);
            const res = await importStudioCustomizationFromJson(content);
            if (res.success) {
              setStatusMessage({
                type: 'success',
                text: `Studio Customization restored successfully (${res.summary})!`,
              });
              onRefreshNeeded();
            } else {
              setStatusMessage({ type: 'error', text: res.error || 'Failed to restore Studio Customization' });
            }
          } catch (err: any) {
            setStatusMessage({ type: 'error', text: `Restore failed: ${err.message}` });
          } finally {
            setIsProcessing(false);
          }
        },
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Invalid JSON file: ${err.message}` });
    } finally {
      e.target.value = '';
    }
  };

  // 2. Report Builder Studio Tasks Backup & Restore
  const handleExportTasks = async () => {
    try {
      setIsProcessing(true);
      const json = await exportReportBuilderTasksToJson();
      const filename = `Daily-Task-Tracker-Report-Builder-Tasks-${getFormattedDate()}.json`;
      triggerDownload(filename, json);
      setStatusMessage({
        type: 'success',
        text: `Report Builder Studio tasks exported successfully (${reportCount} snapshots, ${totalTasks} total tasks).`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Tasks export failed: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTasksFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);

      let reportsList = [];
      if (Array.isArray(parsed.reports)) {
        reportsList = parsed.reports;
      } else if (Array.isArray(parsed)) {
        reportsList = parsed;
      } else if (parsed.id && parsed.date && parsed.slot && Array.isArray(parsed.tasks)) {
        reportsList = [parsed];
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Selected file does not contain valid Report Builder tasks or report snapshots.',
        });
        e.target.value = '';
        return;
      }

      const tasksCount = reportsList.reduce((acc: number, r: any) => acc + (r.tasks?.length || 0), 0);
      const summary = `${reportsList.length} report snapshots (${tasksCount} tasks)`;

      setConfirmModal({
        isOpen: true,
        title: 'Restore Report Builder Tasks?',
        message: `Restore Report Builder data from "${file.name}" (${summary})? This will replace your active reports and task tables with the imported records. Your Studio Customization settings will remain untouched.`,
        confirmText: 'Restore Tasks',
        variant: 'warning',
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          try {
            setIsProcessing(true);
            const res = await importReportBuilderTasksFromJson(content);
            if (res.success) {
              setStatusMessage({
                type: 'success',
                text: `Report Builder tasks restored successfully (${res.summary})!`,
              });
              onRefreshNeeded();
            } else {
              setStatusMessage({ type: 'error', text: res.error || 'Failed to restore tasks' });
            }
          } catch (err: any) {
            setStatusMessage({ type: 'error', text: `Restore failed: ${err.message}` });
          } finally {
            setIsProcessing(false);
          }
        },
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Invalid JSON file: ${err.message}` });
    } finally {
      e.target.value = '';
    }
  };

  // 3. Backlog Work Items Backup & Restore
  const handleExportBacklog = async () => {
    try {
      setIsProcessing(true);
      const json = await exportBacklogToJson();
      const filename = `Daily-Task-Tracker-Backlog-${getFormattedDate()}.json`;
      triggerDownload(filename, json);
      setStatusMessage({
        type: 'success',
        text: `Backlog items exported successfully (${backlogItemsCount} work items).`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Backlog export failed: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBacklogFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setConfirmModal({
        isOpen: true,
        title: 'Restore Backlog Items?',
        message: `Restore sprint and product backlog work items from "${file.name}"? This will replace your existing backlog items with the items in the backup file. Daily task tables and studio settings will not be affected.`,
        confirmText: 'Restore Backlog',
        variant: 'cyan',
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          try {
            setIsProcessing(true);
            const res = await importBacklogFromJson(content);
            if (res.success) {
              setStatusMessage({
                type: 'success',
                text: `Backlog restored successfully: ${res.summary}`,
              });
              onRefreshNeeded();
            } else {
              setStatusMessage({ type: 'error', text: res.error || 'Failed to restore backlog' });
            }
          } catch (err: any) {
            setStatusMessage({ type: 'error', text: `Restore failed: ${err.message}` });
          } finally {
            setIsProcessing(false);
          }
        },
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Invalid JSON file: ${err.message}` });
    } finally {
      e.target.value = '';
    }
  };

  // 4. Full Workspace Backup & Restore
  const handleExportFull = async () => {
    try {
      setIsProcessing(true);
      const json = await exportDatabaseToJson();
      const filename = `Daily-Task-Tracker-Full-Workspace-${getFormattedDate()}.json`;
      triggerDownload(filename, json);
      setStatusMessage({
        type: 'success',
        text: `Full workspace database backup exported successfully (${reportCount} snapshots, ${totalTasks} tasks, ${auditLogsCount} audit logs).`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Full export failed: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFullFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setConfirmModal({
        isOpen: true,
        title: 'Restore Full Workspace Database?',
        message: `Restore entire workspace state from "${file.name}"? This will overwrite your existing local database records (Studio Customization, Report Snapshots, and Audit Logs) with the backup file data.`,
        confirmText: 'Restore Full Database',
        variant: 'danger',
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          try {
            setIsProcessing(true);
            const res = await importDatabaseFromJson(content);
            if (res.success) {
              setStatusMessage({
                type: 'success',
                text: `Full workspace restored successfully (${res.summary || 'All records verified'})!`,
              });
              onRefreshNeeded();
            } else {
              setStatusMessage({ type: 'error', text: res.error || 'Failed to restore full database' });
            }
          } catch (err: any) {
            setStatusMessage({ type: 'error', text: `Restore error: ${err.message}` });
          } finally {
            setIsProcessing(false);
          }
        },
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `File reading error: ${err.message}` });
    } finally {
      e.target.value = '';
    }
  };

  // Factory Complete Reset
  const handleCompleteReset = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Complete Reset (Clear Everything)?',
      message: 'Are you sure you want to completely clear everything? All tasks, report snapshots, audit activity logs, statuses, team members, sections, and note templates will be permanently deleted. The app will return to a completely clean blank slate.',
      confirmText: 'Clear Everything',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setIsProcessing(true);
          await resetDatabaseToDefault();
          setStatusMessage({ type: 'success', text: 'Database completely cleared! Zero mock data, clean blank workspace.' });
          onRefreshNeeded();
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: `Reset error: ${err.message}` });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={customizationInputRef}
        accept=".json"
        onChange={handleCustomizationFileSelected}
        className="hidden"
      />
      <input
        type="file"
        ref={tasksInputRef}
        accept=".json"
        onChange={handleTasksFileSelected}
        className="hidden"
      />
      <input
        type="file"
        ref={backlogInputRef}
        accept=".json"
        onChange={handleBacklogFileSelected}
        className="hidden"
      />
      <input
        type="file"
        ref={fullWorkspaceInputRef}
        accept=".json"
        onChange={handleFullFileSelected}
        className="hidden"
      />

      {/* Database Status Card */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-[#142552]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-[#ff2d5f]/15 flex items-center justify-center text-[#ff2d5f]">
              <Database className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                IndexedDB Workspace Storage Status
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Offline-first client database state with instant JSON export &amp; restore capabilities
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex text-xs font-bold text-emerald-600 dark:text-emerald-400 items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5" /> Offline-First (Dexie)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className="bg-slate-50 dark:bg-[#020612] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
              Report Snapshots
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
              {reportCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Daily tables</span>
          </div>

          <div className="bg-slate-50 dark:bg-[#020612] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
              Total Tasks
            </span>
            <span className="text-xl font-black text-[#ff2d5f] font-mono mt-0.5 block">
              {totalTasks}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">In daily reports</span>
          </div>

          <div className="bg-slate-50 dark:bg-[#020612] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
              Backlog Items
            </span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
              {backlogItemsCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Sprint &amp; product</span>
          </div>

          <div className="bg-slate-50 dark:bg-[#020612] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
              Studio Metadata
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
              {statusesCount + ownersCount + sectionsCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {statusesCount}s • {ownersCount}m • {sectionsCount}sec
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-[#020612] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
              Audit Activities
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
              {auditLogsCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Recorded actions</span>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          )}
          <span className="flex-1">{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Separate Dedicated Backup & Restore Cards */}
      <div className="space-y-4">
        {/* Option 1: Studio Customization Backup & Restore */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#142552]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-[#ff2d5f] border border-pink-200 dark:border-[#ff2d5f]/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Sliders className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Studio Customization (Settings &amp; Workflows)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-[#ff2d5f]/20 text-[#ff2d5f]">
                    Config Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium max-w-2xl">
                  Download or restore team member profiles, custom statuses &amp; workflows, sections, note templates,
                  SLA aging rules, and column layout settings as a dedicated JSON configuration.
                  <strong className="text-slate-800 dark:text-slate-200"> Preserves all task tables and daily reports.</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {statusesCount} Statuses
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {ownersCount} Team Members
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {sectionsCount} Sections
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {noteTemplatesCount} Note Snippets
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons for Studio Customization */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleExportCustomization}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                title="Download Studio Customization as JSON"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Download Customization (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => customizationInputRef.current?.click()}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Upload and restore Studio Customization from JSON"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload &amp; Restore (.json)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Option 2: Report Builder Studio Tasks Backup & Restore */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#142552]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                <FileSpreadsheet className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Report Builder Studio (Tasks &amp; Daily Snapshots)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300">
                    Tasks Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium max-w-2xl">
                  Download or restore all task entries, category velocities, morning/evening snapshots, completion %,
                  blocker notes, and historical calendar logs as a dedicated tasks dataset.
                  <strong className="text-slate-800 dark:text-slate-200"> Preserves all your Studio Customization settings.</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {reportCount} Report Snapshots
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {totalTasks} Total Tasks
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    Morning &amp; Evening Slots
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons for Report Builder Tasks */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleExportTasks}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-600/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                title="Download Report Builder Tasks as JSON"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Download Tasks (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => tasksInputRef.current?.click()}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Upload and restore Report Builder Tasks from JSON"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload &amp; Restore (.json)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Option 3: Sprint & Product Backlog Backup & Restore */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#142552]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Milestone className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Sprint &amp; Product Backlog (Work Items &amp; User Stories)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    Backlog Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium max-w-2xl">
                  Download or restore all product backlog work items, story points, priority rankings, epics,
                  and target sprint assignments as a dedicated JSON file.
                  <strong className="text-slate-800 dark:text-slate-200"> Preserves all your daily report tables and studio settings.</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {backlogItemsCount} Work Items
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    Rankings &amp; Effort Points
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons for Backlog */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleExportBacklog}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                title="Download Backlog Work Items as JSON"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Download Backlog (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => backlogInputRef.current?.click()}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Upload and restore Backlog Items from JSON"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload &amp; Restore (.json)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Option 4: Full Workspace Database Backup & Restore */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#142552]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Database className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Full Workspace Database (All-in-One Complete Archive)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                    Full System
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium max-w-2xl">
                  Comprehensive disaster recovery archive containing everything in one file: Studio Customization,
                  all Report Builder task snapshots, and full Audit Trail activity records.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    Entire IndexedDB State
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {auditLogsCount} Activity Logs Included
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons for Full Workspace */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleExportFull}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-600/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                title="Download Full Database Workspace as JSON"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Download Full (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => fullWorkspaceInputRef.current?.click()}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Upload and restore Full Database Workspace from JSON"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload &amp; Restore (.json)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Reset Danger Zone */}
      <div className="bg-rose-50/60 dark:bg-rose-950/20 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
        <div>
          <h4 className="text-sm font-black text-rose-900 dark:text-rose-300">Complete Reset (Clear Everything)</h4>
          <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5 font-medium">
            Permanently clears all tasks, calendar snapshots, audit logs, statuses, owners, sections, and notes for a 100% clean blank start.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCompleteReset}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-xl text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex-shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear Everything
        </button>
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
