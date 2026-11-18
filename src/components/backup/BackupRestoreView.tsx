import React, { useState, useRef, useEffect } from 'react';
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
  BookmarkCheck,
  History,
  HardDrive,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  Info,
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
  logActivity,
} from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { AppMetadata } from '../../types';

interface BackupRestoreViewProps {
  metadata?: AppMetadata;
  onRefreshNeeded?: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({ metadata: propMeta, onRefreshNeeded }) => {
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshingStorage, setIsRefreshingStorage] = useState(false);

  // Storage Quota State from navigator.storage
  const [storageEstimate, setStorageEstimate] = useState<{
    usage: number;
    quota: number;
    persisted: boolean;
  }>({
    usage: 0,
    quota: 0,
    persisted: true,
  });

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

  // Reactive DB queries for detailed telemetry
  const liveMeta = useLiveQuery(() => db.metadata.get('current_metadata'));
  const effectiveMeta = liveMeta || propMeta;
  const allReports = useLiveQuery(() => db.reports.toArray()) ?? [];
  const allBacklog = useLiveQuery(() => db.backlogItems.toArray()) ?? [];
  const allLogs = useLiveQuery(() => db.auditLogs.toArray()) ?? [];

  // Metrics computation
  const reportCount = allReports.length;
  const totalTasks = allReports.reduce((acc, r) => acc + (r.tasks?.length || 0), 0);
  const reportDates = allReports.map((r) => r.date).filter(Boolean).sort();
  const earliestReportDate = reportDates.length > 0 ? reportDates[0] : null;
  const latestReportDate = reportDates.length > 0 ? reportDates[reportDates.length - 1] : null;

  const backlogItemsCount = allBacklog.length;
  const totalStoryPoints = allBacklog.reduce((acc, b) => acc + (b.storyPoints || 0), 0);
  const criticalP0Count = allBacklog.filter((b) => b.priority === 'P0_CRITICAL').length;
  const inFlightBacklogCount = allBacklog.filter((b) => b.status === 'in_progress' || b.status === 'in_review').length;

  const auditLogsCount = allLogs.length;
  const recent24hLogsCount = allLogs.filter((l) => Date.now() - new Date(l.timestamp).getTime() < 86400000).length;
  const dangerLogsCount = allLogs.filter((l) => l.severity === 'danger').length;

  const statusesCount = effectiveMeta?.statuses?.length || 0;
  const ownersCount = effectiveMeta?.owners?.length || 0;
  const sectionsCount = effectiveMeta?.sections?.length || 0;
  const noteTemplatesCount = effectiveMeta?.noteTemplates?.length || 0;
  const customColumnsCount = effectiveMeta?.columns?.length || 0;
  const agingRulesCount = effectiveMeta?.agingRules?.thresholds?.length || 0;
  const totalMetadataEntities = statusesCount + ownersCount + sectionsCount + noteTemplatesCount + customColumnsCount + agingRulesCount;

  // Refresh hardware storage quota
  const refreshStorageEstimate = async () => {
    setIsRefreshingStorage(true);
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        let persisted = true;
        if (navigator.storage.persisted) {
          persisted = await navigator.storage.persisted();
        }
        setStorageEstimate({
          usage: est.usage || 0,
          quota: est.quota || 0,
          persisted,
        });
      }
    } catch {
      // Ignore if not supported in environment
    } finally {
      setTimeout(() => setIsRefreshingStorage(false), 400);
    }
  };

  useEffect(() => {
    refreshStorageEstimate();
  }, [allReports.length, allBacklog.length, allLogs.length]);

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
      logActivity({
        actionType: 'system',
        actionLabel: 'Studio Customization Exported',
        entityType: 'metadata',
        entityId: 'current_metadata',
        entityTitle: 'Studio Customization Settings',
        actor: 'Admin',
        details: `Exported studio customization settings to ${filename}`,
        severity: 'info',
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
              onRefreshNeeded?.();
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

  // 2. Report Builder Tasks Backup & Restore
  const handleExportTasks = async () => {
    try {
      setIsProcessing(true);
      const json = await exportReportBuilderTasksToJson();
      const filename = `Daily-Task-Tracker-Report-Builder-Tasks-${getFormattedDate()}.json`;
      triggerDownload(filename, json);
      setStatusMessage({
        type: 'success',
        text: `Report Builder tasks exported successfully (${reportCount} snapshots, ${totalTasks} total tasks).`,
      });
      logActivity({
        actionType: 'system',
        actionLabel: 'Report Tasks Exported',
        entityType: 'report',
        entityId: 'all_reports',
        entityTitle: 'All Task Reports',
        actor: 'Admin',
        details: `Exported ${reportCount} snapshots (${totalTasks} tasks) to ${filename}`,
        severity: 'info',
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
        message: `Restore Report Builder data from "${file.name}" (${summary})? This will replace your active reports and task tables with the imported records. Studio Customization settings will remain untouched.`,
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
              onRefreshNeeded?.();
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
        text: `Backlog items exported successfully (${backlogItemsCount} work items, ${totalStoryPoints} points).`,
      });
      logActivity({
        actionType: 'system',
        actionLabel: 'Backlog Exported',
        entityType: 'backlog',
        entityId: 'all_backlog',
        entityTitle: 'Work Item Backlog',
        actor: 'Admin',
        details: `Exported ${backlogItemsCount} backlog tickets to ${filename}`,
        severity: 'info',
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
      const parsed = JSON.parse(content);
      const itemsList = Array.isArray(parsed.backlogItems) ? parsed.backlogItems : Array.isArray(parsed) ? parsed : [];

      if (!itemsList || itemsList.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'Selected file does not contain valid backlog work items.',
        });
        e.target.value = '';
        return;
      }

      setConfirmModal({
        isOpen: true,
        title: 'Restore Work Item Backlog?',
        message: `Restore Backlog items from "${file.name}" (${itemsList.length} tickets)? This will replace your active backlog items with the imported dataset. Daily reports and Studio Customization will remain untouched.`,
        confirmText: 'Restore Backlog',
        variant: 'warning',
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          try {
            setIsProcessing(true);
            const res = await importBacklogFromJson(content);
            if (res.success) {
              setStatusMessage({
                type: 'success',
                text: `Backlog items restored successfully (${res.summary})!`,
              });
              onRefreshNeeded?.();
            } else {
              setStatusMessage({ type: 'error', text: res.error || 'Failed to restore backlog items' });
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

  // 4. Full Workspace Complete Database Backup & Restore
  const handleExportFull = async () => {
    try {
      setIsProcessing(true);
      const json = await exportDatabaseToJson();
      const filename = `Daily-Task-Tracker-FULL-BACKUP-${getFormattedDate()}.json`;
      triggerDownload(filename, json);
      setStatusMessage({
        type: 'success',
        text: `Full workspace backup exported successfully (${reportCount} report snapshots, ${backlogItemsCount} backlog tickets, ${auditLogsCount} audit logs).`,
      });
      logActivity({
        actionType: 'system',
        actionLabel: 'Full Workspace Exported',
        entityType: 'metadata',
        entityId: 'full_database',
        entityTitle: 'Complete Workspace Backup',
        actor: 'Admin',
        details: `Exported full database disaster recovery archive to ${filename}`,
        severity: 'info',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Full backup failed: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFullFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);

      if (!parsed.metadata && !parsed.reports && !parsed.backlogItems) {
        setStatusMessage({
          type: 'error',
          text: 'Selected file is not a valid complete Daily Task Tracker workspace archive.',
        });
        e.target.value = '';
        return;
      }

      const snapshotsCount = parsed.reports?.length || 0;
      const bItemsCount = parsed.backlogItems?.length || 0;
      const summary = `${snapshotsCount} snapshots, ${bItemsCount} backlog tickets, full metadata`;

      setConfirmModal({
        isOpen: true,
        title: 'Restore Complete Workspace?',
        message: `Restore entire database from "${file.name}" (${summary})? This will completely replace your current tasks, backlog, customizations, and settings with the archive records.`,
        confirmText: 'Restore Complete Workspace',
        variant: 'danger',
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          try {
            setIsProcessing(true);
            const res = await importDatabaseFromJson(content);
            if (res.success) {
              setStatusMessage({
                type: 'success',
                text: `Complete workspace restored successfully (${res.summary})!`,
              });
              onRefreshNeeded?.();
            } else {
              setStatusMessage({ type: 'error', text: res.error || 'Failed to restore workspace' });
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

  // Factory Clear Everything
  const handleCompleteReset = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Everything & Reset Workspace?',
      message:
        'CRITICAL ACTION: This permanently wipes all task reports, backlog items, custom statuses, team members, sections, and audit trails. The database will return to an empty clean default state.',
      confirmText: 'Yes, Wipe Everything',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setIsProcessing(true);
          await resetDatabaseToDefault();
          setStatusMessage({
            type: 'success',
            text: 'All workspace tasks and customization have been completely reset to a clean blank state.',
          });
          onRefreshNeeded?.();
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: `Reset failed: ${err.message}` });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const usagePercent =
    storageEstimate.quota > 0 ? Math.min(100, (storageEstimate.usage / storageEstimate.quota) * 100) : 0;

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
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

      {/* Main Header */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff2d5f] to-rose-600 text-white flex items-center justify-center shadow-md shadow-[#ff2d5f]/20">
              <Database className="w-4 h-4 stroke-[2.5]" />
            </div>
            <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Backup &amp; Restore Center
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-[#ff2d5f]/20 text-[#ff2d5f]">
              Offline-First Engine
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
            Manage your local database lifecycle: real-time storage metrics, granular JSON exports, and disaster recovery restores.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={refreshStorageEstimate}
            disabled={isRefreshingStorage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-[#08122f] hover:bg-slate-200 dark:hover:bg-[#0e214d] border border-slate-300 dark:border-[#142552] text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Refresh database telemetry and browser storage estimation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStorage ? 'animate-spin text-[#ff2d5f]' : ''}`} />
            <span>Refresh Storage</span>
          </button>

          <button
            type="button"
            onClick={handleExportFull}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-xl text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="Download complete database archive as a single JSON file"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Download Full Backup</span>
          </button>
        </div>
      </div>

      {/* DETAILED STORAGE STATUS DASHBOARD */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors space-y-4">
        {/* Storage Header & Hardware Quota */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#142552]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                Detailed Storage Engine Status
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Embedded IndexedDB instance <code className="text-[10px] font-mono text-[#ff2d5f]">TaskReportDB (v3)</code> on Dexie driver
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5" />
              {storageEstimate.persisted ? 'Persisted Storage Active' : 'Sandboxed Local Storage'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-lg">
              <Cpu className="w-3.5 h-3.5" />
              Schema v3
            </span>
          </div>
        </div>

        {/* Disk Space & Quota Progress Meter */}
        <div className="bg-slate-50 dark:bg-[#020612] p-4 rounded-xl border border-slate-200 dark:border-[#142552] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              Estimated Browser Quota Usage:
              <strong className="text-slate-900 dark:text-white font-mono">{formatBytes(storageEstimate.usage)}</strong>
              <span className="text-slate-400 font-normal">of</span>
              <strong className="text-slate-900 dark:text-white font-mono">
                {storageEstimate.quota > 0 ? formatBytes(storageEstimate.quota) : 'Unlimited Local Disk'}
              </strong>
            </span>
            <span className="font-mono text-[#ff2d5f]">{usagePercent < 0.01 ? '< 0.01%' : `${usagePercent.toFixed(2)}%`} used</span>
          </div>

          <div className="w-full h-2 bg-slate-200 dark:bg-[#0c1a40] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-[#ff2d5f] to-rose-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(1, usagePercent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
            <span>Client offline safety: Tasks and settings reside securely in local device memory.</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Zero cloud leakage
            </span>
          </div>
        </div>

        {/* Table-by-Table Granular Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Reports */}
          <div className="bg-slate-50 dark:bg-[#020612] p-4 rounded-xl border border-slate-200 dark:border-[#142552] hover:border-[#ff2d5f]/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Daily Reports
              </span>
              <FileSpreadsheet className="w-4 h-4 text-[#ff2d5f]" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono block">
                {reportCount}
              </span>
              <span className="text-xs font-bold text-[#ff2d5f] block mt-0.5">
                {totalTasks} Total Tasks
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-[#142552] text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <div>Table: <code className="font-mono text-slate-700 dark:text-slate-300">reports</code></div>
              <div className="truncate">
                {earliestReportDate && latestReportDate
                  ? `${earliestReportDate} → ${latestReportDate}`
                  : 'No active reports yet'}
              </div>
            </div>
          </div>

          {/* Card 2: Backlog */}
          <div className="bg-slate-50 dark:bg-[#020612] p-4 rounded-xl border border-slate-200 dark:border-[#142552] hover:border-indigo-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Product Backlog
              </span>
              <BookmarkCheck className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono block">
                {backlogItemsCount}
              </span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block mt-0.5">
                {totalStoryPoints} Story Points
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-[#142552] text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <div>Table: <code className="font-mono text-slate-700 dark:text-slate-300">backlogItems</code></div>
              <div>
                {criticalP0Count} P0 Critical • {inFlightBacklogCount} In-Flight
              </div>
            </div>
          </div>

          {/* Card 3: Studio Metadata */}
          <div className="bg-slate-50 dark:bg-[#020612] p-4 rounded-xl border border-slate-200 dark:border-[#142552] hover:border-pink-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Studio Customization
              </span>
              <Sliders className="w-4 h-4 text-pink-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono block">
                {totalMetadataEntities}
              </span>
              <span className="text-xs font-bold text-pink-600 dark:text-pink-400 block mt-0.5">
                Configured Entities
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-[#142552] text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <div>Table: <code className="font-mono text-slate-700 dark:text-slate-300">metadata</code></div>
              <div>
                {statusesCount} Statuses • {ownersCount} Team • {sectionsCount} Sections
              </div>
            </div>
          </div>

          {/* Card 4: Audit Logs */}
          <div className="bg-slate-50 dark:bg-[#020612] p-4 rounded-xl border border-slate-200 dark:border-[#142552] hover:border-cyan-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Activity Audit Trail
              </span>
              <History className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono block">
                {auditLogsCount}
              </span>
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 block mt-0.5">
                Recorded Actions
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-[#142552] text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <div>Table: <code className="font-mono text-slate-700 dark:text-slate-300">auditLogs</code></div>
              <div>
                {recent24hLogsCount} in past 24h • {dangerLogsCount} high alert
              </div>
            </div>
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

      {/* DEDICATED BACKUP & RESTORE STREAMS */}
      <div className="space-y-4">
        {/* Stream 1: Full Workspace Complete Archive */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#142552]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Database className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Full Workspace Database (All-in-One Complete Disaster Recovery)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                    Full System
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium max-w-2xl">
                  Comprehensive master archive containing your entire workspace in a single JSON file: all daily task tables, backlog tickets, Studio Customization, and full audit logs.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {reportCount} Snapshots
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {backlogItemsCount} Backlog Tickets
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {auditLogsCount} Activity Records
                  </span>
                </div>
              </div>
            </div>

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

        {/* Stream 2: Report Builder Tasks Backup & Restore */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#142552]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-[#ff2d5f]/15 text-[#ff2d5f] border border-rose-200 dark:border-[#ff2d5f]/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                <FileSpreadsheet className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Report Builder Tasks &amp; Snapshots
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-[#ff2d5f]/20 text-[#ff2d5f]">
                    Tasks Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium max-w-2xl">
                  Download or restore all daily morning &amp; evening task spreadsheets, statuses, notes, and progress ratings.
                  <strong className="text-slate-800 dark:text-slate-200"> Keeps your Studio Customization and Backlog intact.</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {reportCount} Daily Snapshots
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {totalTasks} Total Tasks
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleExportTasks}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                title="Download Report Tasks as JSON"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Download Tasks (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => tasksInputRef.current?.click()}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Upload and restore Report Tasks from JSON"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload &amp; Restore (.json)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stream 3: Sprint & Product Backlog */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#142552]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                <BookmarkCheck className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Sprint &amp; Product Backlog (Work Items &amp; Epics)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    Backlog Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium max-w-2xl">
                  Download or restore all product backlog work items, story points, priority rankings, epics, and target sprint assignments as a dedicated JSON file.
                  <strong className="text-slate-800 dark:text-slate-200"> Preserves all your daily report tables and studio settings.</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {backlogItemsCount} Work Items
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded border border-slate-200 dark:border-[#142552]">
                    {totalStoryPoints} Story Points
                  </span>
                </div>
              </div>
            </div>

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

        {/* Stream 4: Studio Customization Settings */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#142552]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Sliders className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Studio Customization (Settings &amp; Workflows)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
                    Config Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium max-w-2xl">
                  Download or restore team member profiles, custom statuses &amp; workflows, sections, note templates, SLA aging rules, and column layout settings as a dedicated JSON configuration.
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
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleExportCustomization}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-pink-600/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                title="Download Studio Customization as JSON"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Download Config (.json)</span>
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
      </div>

      {/* Complete Reset Danger Zone */}
      <div className="bg-rose-50/60 dark:bg-rose-950/20 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
        <div>
          <h4 className="text-sm font-black text-rose-900 dark:text-rose-300">Complete Reset (Factory Clean Start)</h4>
          <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5 font-medium">
            Permanently clears all tasks, calendar snapshots, backlog tickets, audit logs, statuses, owners, and sections for a 100% clean start.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCompleteReset}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-xl text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex-shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear Everything
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.message}
        confirmLabel={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
