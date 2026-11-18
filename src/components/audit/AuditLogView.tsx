import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  History,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Calendar,
  User,
  Tag,
  Clock,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
  X,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { AppMetadata, AuditActionType, AuditLogEntry, AuditSeverity } from '../../types';
import { db, logActivity } from '../../db';
import { formatDateSafe } from '../../utils/date';
import { formatDistanceToNow, parseISO, subDays, startOfMonth, isAfter, isEqual } from 'date-fns';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { CustomDropdown } from '../common/CustomDropdown';

interface AuditLogViewProps {
  metadata: AppMetadata;
  onNavigateToReport?: (date: string, slot: 'MORNING' | 'AFTERNOON' | 'EVENING') => void;
}

type DateRangeFilter = 'today' | '7days' | 'month' | 'all';

export const AuditLogView: React.FC<AuditLogViewProps> = ({ metadata, onNavigateToReport }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedActor, setSelectedActor] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');

  // Confirmation Modals & Inspector
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [selectedEntryForInspect, setSelectedEntryForInspect] = useState<AuditLogEntry | null>(null);

  // Clean out any legacy mock seed logs on component mount
  useEffect(() => {
    db.auditLogs.where('id').startsWith('audit_seed_').delete();
  }, []);

  // Live Query from Dexie - strictly sort latest logs first (newest to oldest)
  const logs = useLiveQuery(
    async () => {
      const all = await db.auditLogs.toArray();
      return all.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
    },
    [],
    []
  );

  // Filter logs maintaining the strict latest-first order
  const filteredLogs = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    return logs.filter((entry) => {
      // Date filter
      if (dateFilter !== 'all') {
        try {
          const entryDate = parseISO(entry.timestamp);
          if (dateFilter === 'today') {
            if (!entry.timestamp.startsWith(todayStr)) return false;
          } else if (dateFilter === '7days') {
            const sevenDaysAgo = subDays(today, 7);
            if (!isAfter(entryDate, sevenDaysAgo) && !isEqual(entryDate, sevenDaysAgo)) return false;
          } else if (dateFilter === 'month') {
            const monthStart = startOfMonth(today);
            if (!isAfter(entryDate, monthStart) && !isEqual(entryDate, monthStart)) return false;
          }
        } catch {
          // keep if invalid date
        }
      }

      // Action type filter
      if (selectedActionType !== 'all' && entry.actionType !== selectedActionType) {
        return false;
      }

      // Actor filter
      if (selectedActor !== 'all' && entry.actor !== selectedActor) {
        return false;
      }

      // Severity filter
      if (selectedSeverity !== 'all' && entry.severity !== selectedSeverity) {
        return false;
      }

      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesEntity = entry.entityTitle.toLowerCase().includes(q);
        const matchesDetails = entry.details.toLowerCase().includes(q);
        const matchesActor = entry.actor.toLowerCase().includes(q);
        const matchesAction = entry.actionLabel.toLowerCase().includes(q);
        const matchesSection = (entry.sectionName || '').toLowerCase().includes(q);

        if (!matchesEntity && !matchesDetails && !matchesActor && !matchesAction && !matchesSection) {
          return false;
        }
      }

      return true;
    });
  }, [logs, dateFilter, selectedActionType, selectedActor, selectedSeverity, searchQuery]);

  // Key KPI stats
  const totalEvents = logs.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = logs.filter((l) => l.timestamp.startsWith(todayStr)).length;
  const statusTransitionsCount = logs.filter((l) => l.actionType === 'status_change').length;
  const userActionsCount = logs.filter(
    (l) => l.actionType === 'task_create' || l.actionType === 'completion_update' || l.actionType === 'task_update'
  ).length;

  // Clear Logs
  const handleClearLogs = async () => {
    await db.auditLogs.clear();
    setIsClearModalOpen(false);
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `daily_task_tracker_audit_log_${todayStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Action Type', 'Action Label', 'Severity', 'Actor', 'Actor Role', 'Section', 'Entity Title', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.actionType}"`,
      `"${l.actionLabel}"`,
      `"${l.severity}"`,
      `"${l.actor}"`,
      `"${l.actorRole || ''}"`,
      `"${l.sectionName || ''}"`,
      `"${l.entityTitle.replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daily_task_tracker_audit_log_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getActionBadge = (entry: AuditLogEntry) => {
    switch (entry.actionType) {
      case 'task_create':
        return {
          icon: Sparkles,
          color: 'bg-rose-50 dark:bg-[#ff2d5f]/15 text-[#ff2d5f] border-rose-200 dark:border-[#ff2d5f]/30',
        };
      case 'status_change':
        return {
          icon: CheckCircle2,
          color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
        };
      case 'completion_update':
        return {
          icon: ArrowRight,
          color: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40',
        };
      case 'task_update':
        return {
          icon: Info,
          color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
        };
      case 'task_reorder':
        return {
          icon: RefreshCw,
          color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40',
        };
      case 'rollover':
        return {
          icon: History,
          color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
        };
      case 'export':
        return {
          icon: Download,
          color: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/40',
        };
      case 'task_delete':
      case 'batch_delete':
        return {
          icon: Trash2,
          color: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40',
        };
      case 'metadata_update':
        return {
          icon: ShieldCheck,
          color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40',
        };
      case 'system':
      default:
        return {
          icon: RefreshCw,
          color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        };
    }
  };

  // Distinct actors for filter
  const distinctActors = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(l.actor));
    return Array.from(set);
  }, [logs]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* Top Header & Audit Summary */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#050c21]/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <History className="w-4 h-4 text-[#ff2d5f]" />
              System Audit &amp; Activity Log
            </h1>
            <span className="px-2 py-0.2 text-[9px] font-black uppercase rounded-full bg-rose-50 dark:bg-[#ff2d5f]/15 text-[#ff2d5f] border border-rose-200 dark:border-[#ff2d5f]/30">
              Live Trace
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
            Real-time activity audit trail. Every status transition, progress shift, density adjustment, table reset, and export is recorded here.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#08122f] dark:hover:bg-[#0e214d] text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-[#142552] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download CSV for Excel or Google Sheets"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#08122f] dark:hover:bg-[#0e214d] text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-[#142552] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export raw JSON log file"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setIsClearModalOpen(true)}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Clear all stored audit log events"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#050c21] p-4 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Logged Events
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {totalEvents}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              Recorded live in this session
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#08122f] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#142552] flex items-center justify-center font-bold">
            <History className="w-5 h-5 text-[#ff2d5f]" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#050c21] p-4 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Today's Activities
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {todayCount}
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block">
              Logged since midnight
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#050c21] p-4 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Status Transitions
            </span>
            <div className="text-2xl font-black text-[#ff2d5f] font-mono mt-1">
              {statusTransitionsCount}
            </div>
            <span className="text-[11px] text-rose-600 dark:text-[#ff2d5f] font-semibold mt-0.5 block">
              Task lifecycle updates
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-[#ff2d5f]/15 text-[#ff2d5f] border border-rose-200/60 dark:border-[#ff2d5f]/30 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#050c21] p-4 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Task Modifications
            </span>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">
              {userActionsCount}
            </div>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5 block">
              Creations &amp; velocity changes
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#050c21] p-3 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit log by title, action, actor, details, or section..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#020612] text-xs font-medium text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-[#142552] focus:outline-none focus:ring-1 focus:ring-[#ff2d5f]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Range Buttons */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-[#020612] rounded-lg border border-slate-200 dark:border-[#142552] text-xs">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: 'month', label: 'Month' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDateFilter(f.id)}
                className={`px-2.5 py-1 rounded font-bold text-xs transition-all cursor-pointer ${
                  dateFilter === f.id
                    ? 'bg-[#ff2d5f] text-white font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#142552]">
          {/* Action Type Dropdown */}
          <div className="min-w-[160px]">
            <CustomDropdown
              value={selectedActionType}
              onChange={setSelectedActionType}
              options={[
                { value: 'all', label: 'All Action Types' },
                { value: 'task_create', label: 'Task Created' },
                { value: 'status_change', label: 'Status Transition' },
                { value: 'completion_update', label: 'Completion % Updated' },
                { value: 'task_update', label: 'Task Updated' },
                { value: 'task_reorder', label: 'Tasks Reordered' },
                { value: 'rollover', label: 'Rollover Executed' },
                { value: 'export', label: 'Export / Dispatch' },
                { value: 'task_delete', label: 'Task Deleted' },
                { value: 'batch_delete', label: 'Batch Deleted' },
                { value: 'system', label: 'System & Reset' },
                { value: 'metadata_update', label: 'Studio Settings' },
              ]}
              className="w-full text-xs"
              buttonClassName="py-1 px-2.5 text-xs font-bold"
            />
          </div>

          {/* Actor Dropdown */}
          <div className="min-w-[160px]">
            <CustomDropdown
              value={selectedActor}
              onChange={setSelectedActor}
              options={[
                { value: 'all', label: 'All Team Members' },
                ...distinctActors.map((actor) => ({
                  value: actor,
                  label: actor,
                })),
              ]}
              className="w-full text-xs"
              buttonClassName="py-1 px-2.5 text-xs font-bold"
            />
          </div>

          {/* Severity Dropdown */}
          <div className="min-w-[140px]">
            <CustomDropdown
              value={selectedSeverity}
              onChange={setSelectedSeverity}
              options={[
                { value: 'all', label: 'All Severities' },
                { value: 'info', label: 'Info' },
                { value: 'success', label: 'Success' },
                { value: 'warning', label: 'Warning' },
                { value: 'danger', label: 'Danger / Delete' },
              ]}
              className="w-full text-xs"
              buttonClassName="py-1 px-2.5 text-xs font-bold"
            />
          </div>

          {/* Reset Filters */}
          {(searchQuery || selectedActionType !== 'all' || selectedActor !== 'all' || selectedSeverity !== 'all' || dateFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedActionType('all');
                setSelectedActor('all');
                setSelectedSeverity('all');
                setDateFilter('all');
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}

          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-auto">
            Showing {filteredLogs.length} of {totalEvents} events
          </span>
        </div>
      </div>

      {/* Main Audit Log Table - Strictly Aligned, Zero Overlap */}
      <div className="bg-white dark:bg-[#020612] rounded-2xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', minWidth: '850px' }}>
            <colgroup>
              <col style={{ width: '115px' }} />
              <col style={{ width: '145px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '190px' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '65px' }} />
            </colgroup>

            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 dark:bg-[#0b1a3d] text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-[#142552]">
                <th className="px-2.5 py-2.5 border-r border-slate-200 dark:border-[#142552]">Timestamp</th>
                <th className="px-2.5 py-2.5 border-r border-slate-200 dark:border-[#142552]">Action Event</th>
                <th className="px-2.5 py-2.5 border-r border-slate-200 dark:border-[#142552]">Actor</th>
                <th className="px-2.5 py-2.5 border-r border-slate-200 dark:border-[#142552]">Target Entity</th>
                <th className="px-2.5 py-2.5 border-r border-slate-200 dark:border-[#142552]">Details &amp; Transitions</th>
                <th className="px-2 py-2.5 text-center">Inspect</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-[#142552]/70 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-500 dark:text-slate-400">
                    <History className="w-10 h-10 mx-auto text-[#ff2d5f]/60 mb-3 animate-pulse" />
                    <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                      Audit Log Ready &amp; Clean
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                      All activities (status transitions, progress updates, task creations, deletions, density switches, and table resets) will be automatically captured here in real-time as you perform actions.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => {
                  const badge = getActionBadge(entry);
                  const BadgeIcon = badge.icon;
                  const timeFormatted = formatDateSafe(entry.timestamp, 'dd MMM, HH:mm:ss');
                  let relativeTime = '';
                  try {
                    relativeTime = formatDistanceToNow(parseISO(entry.timestamp), { addSuffix: true });
                  } catch {
                    relativeTime = '';
                  }

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#071330] transition-colors group align-top"
                    >
                      {/* 1. Timestamp */}
                      <td className="px-2.5 py-2.5 border-r border-slate-200 dark:border-[#142552] whitespace-nowrap align-top">
                        <div className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">
                          {timeFormatted}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate" title={entry.timestamp}>
                          {relativeTime}
                        </div>
                      </td>

                      {/* 2. Action Type Badge (Compact, No Overlap) */}
                      <td className="px-2.5 py-2.5 border-r border-slate-200 dark:border-[#142552] align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border max-w-full truncate shadow-2xs ${badge.color}`}
                          title={entry.actionLabel}
                        >
                          <BadgeIcon className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{entry.actionLabel}</span>
                        </span>
                      </td>

                      {/* 3. Actor */}
                      <td className="px-2.5 py-2.5 border-r border-slate-200 dark:border-[#142552] align-top">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black text-white shadow-2xs"
                            style={{ backgroundColor: entry.actorAvatarColor || '#ff2d5f' }}
                          >
                            {entry.actor.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-xs text-slate-900 dark:text-white block truncate" title={entry.actor}>
                              {entry.actor}
                            </span>
                            {entry.actorRole && (
                              <span className="text-[9px] text-slate-400 block truncate" title={entry.actorRole}>
                                {entry.actorRole}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Target Entity */}
                      <td className="px-2.5 py-2.5 border-r border-slate-200 dark:border-[#142552] align-top">
                        <div className="space-y-0.5 min-w-0">
                          {entry.sectionName && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 inline-block truncate max-w-full">
                              {entry.sectionName}
                            </span>
                          )}
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate" title={entry.entityTitle}>
                            {entry.entityTitle}
                          </div>
                        </div>
                      </td>

                      {/* 5. Details & Transitions */}
                      <td className="px-3 py-2.5 border-r border-slate-200 dark:border-[#142552] align-top">
                        <div className="space-y-1">
                          <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed" title={entry.details}>
                            {entry.details}
                          </p>

                          {/* Changes Before / After Diff */}
                          {entry.changes && entry.changes.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {entry.changes.map((ch, idx) => (
                                <div
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono bg-slate-100 dark:bg-[#071330] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#142552]"
                                >
                                  <span className="text-slate-400 font-bold">{ch.fieldLabel || ch.field}:</span>
                                  {ch.from !== undefined && (
                                    <>
                                      <span className="text-slate-500 line-through">{String(ch.from)}</span>
                                      <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                    </>
                                  )}
                                  <span className="text-emerald-600 dark:text-emerald-400 font-black">
                                    {String(ch.to)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 6. Inspect Button */}
                      <td className="px-2 py-2.5 text-center align-top">
                        <button
                          type="button"
                          onClick={() => setSelectedEntryForInspect(entry)}
                          className="px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-[#ff2d5f] dark:hover:text-[#ff2d5f] bg-slate-100 dark:bg-[#08122f] hover:bg-rose-50 dark:hover:bg-[#ff2d5f]/15 rounded border border-slate-200 dark:border-[#142552] transition-colors cursor-pointer"
                          title="Inspect raw audit entry details"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Logs */}
      <ConfirmationModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClearLogs}
        title="Clear All Audit Logs?"
        description="Are you sure you want to permanently clear the audit log history? This will delete all recorded activity traces."
        confirmLabel="Clear Audit Log"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* Inspect Detail Modal (Portal to body, z-[99999]) */}
      {selectedEntryForInspect &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] max-w-xl w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#142552]">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#ff2d5f]" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Audit Log Event Inspector
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntryForInspect(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-[#020612] rounded-xl border border-slate-200 dark:border-[#142552]">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Event ID</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{selectedEntryForInspect.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Exact Timestamp</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{selectedEntryForInspect.timestamp}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Actor &amp; Role</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedEntryForInspect.actor} ({selectedEntryForInspect.actorRole || 'Member'})</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Action Type</span>
                    <span className="font-bold text-[#ff2d5f]">{selectedEntryForInspect.actionLabel} ({selectedEntryForInspect.actionType})</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Entity Target</span>
                  <p className="font-bold text-slate-900 dark:text-white p-2.5 bg-slate-50 dark:bg-[#020612] rounded-lg border border-slate-200 dark:border-[#142552]">
                    {selectedEntryForInspect.entityTitle}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Detailed Description</span>
                  <p className="text-slate-700 dark:text-slate-300 p-2.5 bg-slate-50 dark:bg-[#020612] rounded-lg border border-slate-200 dark:border-[#142552]">
                    {selectedEntryForInspect.details}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Raw JSON Payload</span>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-40 border border-slate-800">
                    {JSON.stringify(selectedEntryForInspect, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-[#142552]">
                <button
                  type="button"
                  onClick={() => setSelectedEntryForInspect(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#08122f] dark:hover:bg-[#0e214d] text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
