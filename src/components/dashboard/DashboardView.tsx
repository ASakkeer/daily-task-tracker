import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  ShieldAlert,
  Bug,
  CheckCircle2,
  Filter,
  ArrowRight,
  Clock,
  Sparkles,
  Flame,
  Layers,
  RotateCcw,
  Users,
  Target,
} from 'lucide-react';
import { AppMetadata, ReportSnapshot, TaskRow } from '../../types';
import { calculateDaysOverdue } from '../../utils/aging';
import { formatDateSafe, getTodayDateStr } from '../../utils/date';
import { subDays, startOfMonth, parseISO, isAfter, isEqual } from 'date-fns';
import { CustomDropdown } from '../common/CustomDropdown';

interface DashboardViewProps {
  metadata: AppMetadata;
  reports: ReportSnapshot[];
  onNavigateToReport?: (date: string, slot: 'MORNING' | 'AFTERNOON' | 'EVENING') => void;
}

type DateRangeFilter = 'today' | '7days' | 'month' | 'all';
type ChartViewMode = 'category' | 'owner';

// 1. Custom Tooltip for Stacked Status Breakdown (Category or Owner)
const CustomStackedBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);

  return (
    <div className="bg-white/95 dark:bg-[#020612]/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-[#142552] shadow-2xl text-xs z-50 min-w-[200px]">
      <div className="font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#142552] pb-1.5 mb-2 flex items-center justify-between">
        <span className="truncate">{label}</span>
        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold ml-2">
          {total} {total === 1 ? 'Task' : 'Tasks'}
        </span>
      </div>
      <div className="space-y-1.5">
        {payload
          .filter((entry: any) => (Number(entry.value) || 0) > 0)
          .map((entry: any, index: number) => {
            const count = Number(entry.value) || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={index} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.color || entry.fill }}
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                    {entry.name}
                  </span>
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-white flex-shrink-0">
                  {count} <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                </div>
              </div>
            );
          })}
        {total === 0 && (
          <div className="text-slate-400 italic text-[11px]">No active tasks</div>
        )}
      </div>
    </div>
  );
};

// 2. Custom Tooltip for Daily Trend (Completion % vs Confidence %)
const CustomTrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white/95 dark:bg-[#020612]/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-[#142552] shadow-2xl text-xs z-50 min-w-[200px]">
      <div className="font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#142552] pb-1.5 mb-2">
        {label} Snapshot Velocity
      </div>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">{entry.name}</span>
            </div>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {entry.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 3. Custom Tooltip for Aging Distribution Heatmap
const CustomAgingTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-white/95 dark:bg-[#020612]/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-[#142552] shadow-2xl text-xs z-50 min-w-[190px]">
      <div className="font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#142552] pb-1.5 mb-2">
        {data.name}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-600 dark:text-slate-400">Overdue Tasks:</span>
        <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
          {data.count} {data.count === 1 ? 'task' : 'tasks'}
        </span>
      </div>
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  metadata,
  reports,
  onNavigateToReport,
}) => {
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('7days');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('category');
  const [feedDate, setFeedDate] = useState<string>(getTodayDateStr());

  const todayStr = getTodayDateStr();

  // Filter reports according to selected Date Range
  const filteredReports = useMemo(() => {
    const today = parseISO(todayStr);

    return reports.filter((rep) => {
      try {
        const repDate = parseISO(rep.date);
        if (dateFilter === 'today') {
          return rep.date === todayStr;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = subDays(today, 7);
          return isAfter(repDate, sevenDaysAgo) || isEqual(repDate, sevenDaysAgo);
        } else if (dateFilter === 'month') {
          const monthStart = startOfMonth(today);
          return isAfter(repDate, monthStart) || isEqual(repDate, monthStart);
        }
        return true;
      } catch {
        return true;
      }
    });
  }, [reports, dateFilter, todayStr]);

  // Extract deduped daily tasks (taking the latest slot of each day) with Category & Owner filters
  const relevantTasks = useMemo(() => {
    const byDate = new Map<string, ReportSnapshot>();
    const slotPriority = { MORNING: 1, AFTERNOON: 2, EVENING: 3 };

    filteredReports.forEach((rep) => {
      const existing = byDate.get(rep.date);
      if (!existing || slotPriority[rep.slot] > slotPriority[existing.slot]) {
        byDate.set(rep.date, rep);
      }
    });

    const tasksList: { task: TaskRow; reportDate: string }[] = [];
    byDate.forEach((rep) => {
      rep.tasks.forEach((t) => {
        const matchesOwner = selectedOwnerId === 'all' || t.ownerIds.includes(selectedOwnerId);
        const matchesSection = selectedSectionId === 'all' || t.sectionId === selectedSectionId;
        if (matchesOwner && matchesSection) {
          tasksList.push({ task: t, reportDate: rep.date });
        }
      });
    });

    return tasksList;
  }, [filteredReports, selectedOwnerId, selectedSectionId]);

  // KPI Computations
  const totalTasks = relevantTasks.length;
  const avgCompletion =
    totalTasks > 0
      ? Math.round(relevantTasks.reduce((sum, item) => sum + item.task.completionPct, 0) / totalTasks)
      : 0;

  const avgConfidence =
    totalTasks > 0
      ? Math.round(relevantTasks.reduce((sum, item) => sum + item.task.confidencePct, 0) / totalTasks)
      : 0;

  const overdueCount = relevantTasks.filter((item) => {
    const days = calculateDaysOverdue(item.task.etaDate, item.reportDate, metadata.agingRules);
    return days > 0 && item.task.completionPct < 100;
  }).length;

  const openBugsCount = relevantTasks.filter((item) => {
    const sec = metadata.sections.find((s) => s.id === item.task.sectionId);
    const isBug = sec?.isBugSection || item.task.category.toLowerCase().includes('bug');
    return isBug && item.task.completionPct < 100;
  }).length;

  // Chart 1: Status Breakdown by Category / Section (Stacked Bar)
  const statusByCategoryData = useMemo(() => {
    return metadata.sections
      .filter((sec) => selectedSectionId === 'all' || sec.id === selectedSectionId)
      .map((sec) => {
        const sectionTasks = relevantTasks
          .filter((item) => item.task.sectionId === sec.id)
          .map((i) => i.task);

        const entry: Record<string, any> = {
          name: sec.title,
          fullName: sec.title,
          totalTasks: sectionTasks.length,
        };

        metadata.statuses.forEach((status) => {
          const count = sectionTasks.filter((t) => {
            if (t.customStatus) {
              return status.id === 'status_in_progress';
            }
            return t.statusId === status.id;
          }).length;
          entry[status.label] = count;
        });

        return entry;
      });
  }, [metadata, relevantTasks, selectedSectionId]);

  // Chart 1 Alternate: Status Breakdown by Team Member (Stacked Bar)
  const statusByOwnerData = useMemo(() => {
    return metadata.owners
      .filter((owner) => selectedOwnerId === 'all' || owner.id === selectedOwnerId)
      .map((owner) => {
        const ownerTasks = relevantTasks
          .filter((item) => item.task.ownerIds.includes(owner.id))
          .map((i) => i.task);

        const entry: Record<string, any> = {
          name: owner.name.split(' ')[0], // short name
          fullName: owner.name,
          totalTasks: ownerTasks.length,
        };

        metadata.statuses.forEach((status) => {
          const count = ownerTasks.filter((t) => {
            if (t.customStatus) {
              return status.id === 'status_in_progress';
            }
            return t.statusId === status.id;
          }).length;
          entry[status.label] = count;
        });

        return entry;
      });
  }, [metadata, relevantTasks, selectedOwnerId]);

  // Category Velocity Breakdown
  const categoryVelocityData = useMemo(() => {
    return metadata.sections
      .filter((sec) => selectedSectionId === 'all' || sec.id === selectedSectionId)
      .map((sec) => {
        const secTasks = relevantTasks
          .filter((item) => item.task.sectionId === sec.id)
          .map((i) => i.task);

        const total = secTasks.length;
        const completed = secTasks.filter((t) => t.completionPct === 100).length;
        const inProgress = secTasks.filter((t) => t.completionPct > 0 && t.completionPct < 100).length;
        const notStarted = secTasks.filter((t) => t.completionPct === 0).length;
        const avgComp = total > 0 ? Math.round(secTasks.reduce((acc, t) => acc + t.completionPct, 0) / total) : 0;
        const avgConf = total > 0 ? Math.round(secTasks.reduce((acc, t) => acc + t.confidencePct, 0) / total) : 0;

        return {
          id: sec.id,
          title: sec.title,
          isBugSection: sec.isBugSection,
          total,
          completed,
          inProgress,
          notStarted,
          avgCompletion: avgComp,
          avgConfidence: avgConf,
        };
      });
  }, [metadata, relevantTasks, selectedSectionId]);

  // Chart 2: Daily Completion vs. Confidence Trend (Area / Line Chart)
  const trendData = useMemo(() => {
    const dateMap = new Map<string, { totalComp: number; totalConf: number; count: number }>();

    filteredReports
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((rep) => {
        const key = rep.date;
        const current = dateMap.get(key) || { totalComp: 0, totalConf: 0, count: 0 };
        rep.tasks.forEach((t) => {
          const matchesOwner = selectedOwnerId === 'all' || t.ownerIds.includes(selectedOwnerId);
          const matchesSection = selectedSectionId === 'all' || t.sectionId === selectedSectionId;
          if (matchesOwner && matchesSection) {
            current.totalComp += t.completionPct;
            current.totalConf += t.confidencePct;
            current.count += 1;
          }
        });
        if (current.count > 0) {
          dateMap.set(key, current);
        }
      });

    return Array.from(dateMap.entries()).map(([dateStr, data]) => ({
      date: formatDateSafe(dateStr, 'dd MMM'),
      fullDate: dateStr,
      avgCompletion: Math.round(data.totalComp / data.count),
      avgConfidence: Math.round(data.totalConf / data.count),
    }));
  }, [filteredReports, selectedOwnerId, selectedSectionId]);

  // Chart 3: ETA Aging Distribution
  const agingData = useMemo(() => {
    let onTime = 0;
    let oneDay = 0;
    let twoToThree = 0;
    let fourToSix = 0;
    let sevenPlus = 0;

    relevantTasks.forEach((item) => {
      const days = calculateDaysOverdue(item.task.etaDate, item.reportDate, metadata.agingRules);
      if (item.task.completionPct === 100) {
        onTime += 1;
      } else if (days <= 0) {
        onTime += 1;
      } else if (days === 1) {
        oneDay += 1;
      } else if (days <= 3) {
        twoToThree += 1;
      } else if (days <= 6) {
        fourToSix += 1;
      } else {
        sevenPlus += 1;
      }
    });

    return [
      { name: 'On Time', count: onTime, color: '#10B981' },
      { name: '1 Day Overdue', count: oneDay, color: '#F87171' },
      { name: '2-3 Days', count: twoToThree, color: '#EF4444' },
      { name: '4-6 Days', count: fourToSix, color: '#DC2626' },
      { name: '7+ Days', count: sevenPlus, color: '#991B1B' },
    ];
  }, [relevantTasks, metadata.agingRules]);

  // Morning-to-Evening Change Feed
  const changeFeed = useMemo(() => {
    const morningRep = reports.find((r) => r.date === feedDate && r.slot === 'MORNING');
    const eveningRep = reports.find(
      (r) => r.date === feedDate && (r.slot === 'EVENING' || r.slot === 'AFTERNOON')
    );

    if (!morningRep || !eveningRep) {
      return { hasBothSlots: false, changes: [] };
    }

    const changesList: {
      task: TaskRow;
      changeType: 'completed' | 'progress' | 'status' | 'added' | 'notes';
      description: string;
      beforeVal?: string;
      afterVal?: string;
    }[] = [];

    eveningRep.tasks.forEach((pmTask) => {
      const amTask = morningRep.tasks.find((t) => t.id === pmTask.id);

      if (!amTask) {
        changesList.push({
          task: pmTask,
          changeType: 'added',
          description: 'New task introduced in Evening slot',
          afterVal: `${pmTask.completionPct}%`,
        });
      } else {
        const compChanged = amTask.completionPct !== pmTask.completionPct;
        const statusChanged = amTask.statusId !== pmTask.statusId;
        const notesChanged = amTask.notes !== pmTask.notes;

        if (pmTask.completionPct === 100 && amTask.completionPct < 100) {
          changesList.push({
            task: pmTask,
            changeType: 'completed',
            description: 'Task achieved 100% completion in Evening',
            beforeVal: `${amTask.completionPct}%`,
            afterVal: '100% (Green)',
          });
        } else if (compChanged) {
          changesList.push({
            task: pmTask,
            changeType: 'progress',
            description: `Completion shifted from ${amTask.completionPct}% to ${pmTask.completionPct}%`,
            beforeVal: `${amTask.completionPct}%`,
            afterVal: `${pmTask.completionPct}%`,
          });
        } else if (statusChanged) {
          const prevStatusLabel = metadata.statuses.find((s) => s.id === amTask.statusId)?.label || amTask.statusId;
          const newStatusLabel = metadata.statuses.find((s) => s.id === pmTask.statusId)?.label || pmTask.statusId;
          changesList.push({
            task: pmTask,
            changeType: 'status',
            description: `Status transitioned: ${prevStatusLabel} → ${newStatusLabel}`,
            beforeVal: prevStatusLabel,
            afterVal: newStatusLabel,
          });
        } else if (notesChanged) {
          changesList.push({
            task: pmTask,
            changeType: 'notes',
            description: 'Blockers / Progress notes updated',
            beforeVal: amTask.notes,
            afterVal: pmTask.notes,
          });
        }
      }
    });

    return { hasBothSlots: true, changes: changesList };
  }, [reports, feedDate, metadata]);

  const hasActiveFilters = selectedOwnerId !== 'all' || selectedSectionId !== 'all' || dateFilter !== '7days';

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* Header & Filter Bar (Sticky, Streamlined) */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#050c21]/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Team Analytics &amp; Delivery Progress
            </h1>
            <span className="px-2 py-0.2 text-[9px] font-black uppercase rounded-full bg-rose-50 dark:bg-[#ff2d5f]/15 text-rose-900 dark:text-[#ff2d5f] border border-rose-200 dark:border-[#ff2d5f]/30">
              Live Engine
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
            Category velocity, team workload distributions, historical completion trends, and overdue aging analytics.
          </p>
        </div>

        {/* Global Multi-Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Filter */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-[#020612] rounded-lg border border-slate-200 dark:border-[#142552] text-xs">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-1.5 uppercase tracking-wider">
              Range:
            </span>
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: 'month', label: 'Month' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDateFilter(f.id)}
                className={`px-2.5 py-1 rounded-md font-bold text-xs transition-all cursor-pointer ${
                  dateFilter === f.id
                    ? 'bg-[#ff2d5f] text-white font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category / Section Filter */}
          <div className="min-w-[180px]">
            <CustomDropdown
              value={selectedSectionId}
              onChange={setSelectedSectionId}
              options={[
                { value: 'all', label: 'All Categories / Sections' },
                ...metadata.sections.map((sec) => ({
                  value: sec.id,
                  label: sec.title,
                })),
              ]}
              className="w-full text-xs"
              buttonClassName="py-1 px-2.5 text-xs font-bold"
            />
          </div>

          {/* Owner Filter */}
          <div className="min-w-[170px]">
            <CustomDropdown
              value={selectedOwnerId}
              onChange={setSelectedOwnerId}
              options={[
                { value: 'all', label: 'All Team Members' },
                ...metadata.owners.map((owner) => ({
                  value: owner.id,
                  label: owner.name,
                  avatarColor: owner.avatarColor,
                })),
              ]}
              className="w-full text-xs"
              buttonClassName="py-1 px-2.5 text-xs font-bold"
            />
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedOwnerId('all');
                setSelectedSectionId('all');
                setDateFilter('7days');
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              title="Reset dashboard filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Avg Team Completion
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {avgCompletion}%
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Across {totalTasks} filtered tasks
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center font-bold shadow-2xs">
            <TrendingUp className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Avg Confidence Score
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {avgConfidence}%
            </div>
            <span className="text-[11px] text-rose-600 dark:text-[#ff2d5f] font-semibold flex items-center gap-1 mt-1">
              <Sparkles className="w-3.5 h-3.5" /> Team delivery sentiment
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-[#ff2d5f]/15 text-rose-600 dark:text-[#ff2d5f] border border-rose-200/60 dark:border-[#ff2d5f]/30 flex items-center justify-center font-bold shadow-2xs">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Overdue Tasks
            </span>
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">
              {overdueCount}
            </div>
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5" /> Past target ETA dates
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 flex items-center justify-center font-bold shadow-2xs">
            <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Open Bugs
            </span>
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
              {openBugsCount}
            </div>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-1">
              <Bug className="w-3.5 h-3.5" /> Unresolved defect tickets
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center font-bold shadow-2xs">
            <Bug className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Category Progress & Velocity Summary Row */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#ff2d5f]" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Category Velocity &amp; Completion Breakdown
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {categoryVelocityData.length} Active {categoryVelocityData.length === 1 ? 'Section' : 'Sections'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {categoryVelocityData.map((sec) => (
            <div
              key={sec.id}
              className="p-3.5 bg-slate-50 dark:bg-[#020612] rounded-xl border border-slate-200 dark:border-[#142552] space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      sec.isBugSection ? 'bg-amber-500' : 'bg-[#ff2d5f]'
                    }`}
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {sec.title}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-[#08122f] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-[#142552]">
                  {sec.total} {sec.total === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  <span>Velocity: <strong>{sec.avgCompletion}%</strong></span>
                  <span>Confidence: <strong>{sec.avgConfidence}%</strong></span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-[#142552] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-[#ff2d5f] rounded-full transition-all duration-300"
                    style={{ width: `${sec.avgCompletion}%` }}
                  />
                </div>
              </div>

              {/* Counts */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-[#142552]/70">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓ {sec.completed} Completed
                </span>
                <span className="text-[#ff2d5f] font-bold">
                  ⚡ {sec.inProgress} In Progress
                </span>
                <span>
                  ○ {sec.notStarted} Pending
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Status Breakdown with Category / Owner Toggle */}
        <div className="lg:col-span-7 bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {chartViewMode === 'category'
                  ? 'Task Status Breakdown by Category'
                  : 'Task Status Breakdown by Team Member'}
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {chartViewMode === 'category'
                  ? 'Distribution of task states across sprint sections'
                  : 'Workload distribution across team members'}
              </span>
            </div>

            {/* Toggle Category vs Team Member */}
            <div className="inline-flex p-0.5 bg-slate-100 dark:bg-[#020612] rounded-lg border border-slate-200 dark:border-[#142552] text-xs self-start sm:self-center">
              <button
                type="button"
                onClick={() => setChartViewMode('category')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded font-bold text-xs transition-all cursor-pointer ${
                  chartViewMode === 'category'
                    ? 'bg-[#ff2d5f] text-white font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>By Category</span>
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('owner')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded font-bold text-xs transition-all cursor-pointer ${
                  chartViewMode === 'owner'
                    ? 'bg-[#ff2d5f] text-white font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>By Team Member</span>
              </button>
            </div>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            {(chartViewMode === 'category' ? statusByCategoryData : statusByOwnerData).length === 0 || metadata.statuses.length === 0 ? (
              <div className="text-center p-6 text-xs text-slate-400 dark:text-slate-500">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <span>No status distribution data available. Add tasks and configure statuses in Studio Customization to view metrics.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartViewMode === 'category' ? statusByCategoryData : statusByOwnerData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#142552" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip content={<CustomStackedBarTooltip />} cursor={{ fill: 'rgba(255, 45, 95, 0.05)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {metadata.statuses.map((status) => (
                    <Bar
                      key={status.id}
                      dataKey={status.label}
                      stackId="a"
                      fill={
                        status.isCompletedState
                          ? '#10B981'
                          : status.label === 'Waiting for fix'
                          ? '#F59E0B'
                          : status.label === 'In progress'
                          ? '#ff2d5f'
                          : status.label === 'Blocked'
                          ? '#EF4444'
                          : '#94A3B8'
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: ETA Aging Distribution */}
        <div className="lg:col-span-5 bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                ETA Aging Heatmap Distribution
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">Tasks grouped by overdue calendar days</span>
            </div>
            <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#142552" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<CustomAgingTooltip />} cursor={{ fill: 'rgba(255, 45, 95, 0.05)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {agingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Daily Completion vs. Confidence Trend */}
        <div className="lg:col-span-12 bg-white dark:bg-[#050c21] p-5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Daily Completion % vs. Confidence % Historical Trend
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Tracking velocity trajectory across daily status snapshots
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="compGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="confGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff2d5f" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ff2d5f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#142552" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<CustomTrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="avgCompletion"
                  name="Avg Completion %"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#compGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="avgConfidence"
                  name="Avg Confidence %"
                  stroke="#ff2d5f"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#confGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Morning-to-Evening Change Feed */}
      <div className="bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="p-5 bg-slate-50/80 dark:bg-[#020612]/70 border-b border-slate-200 dark:border-[#142552] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Morning-to-Evening End-of-Day Change Feed
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Automated audit trail of progress recorded between AM kickoff and PM wrap-up.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Select Date:</span>
            <input
              type="date"
              value={feedDate}
              onChange={(e) => setFeedDate(e.target.value)}
              className="text-xs font-bold px-3 py-1.5 bg-white dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="p-5">
          {!changeFeed.hasBothSlots ? (
            <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400 font-medium">
              No comparison available for {feedDate}. Ensure both Morning and Evening reports exist for this date.
            </div>
          ) : changeFeed.changes.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400 font-medium">
              Zero changes detected between Morning and Evening reports on {feedDate}.
            </div>
          ) : (
            <div className="space-y-3">
              {changeFeed.changes.map((item, idx) => {
                const ownerNames = item.task.ownerIds
                  .map((id) => metadata.owners.find((o) => o.id === id)?.name)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 dark:bg-[#020612]/60 rounded-xl border border-slate-200 dark:border-[#142552] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-100/60 dark:hover:bg-[#020612] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            item.changeType === 'completed'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60'
                              : item.changeType === 'progress'
                              ? 'bg-rose-100 dark:bg-[#ff2d5f]/15 text-rose-900 dark:text-[#ff2d5f] border border-rose-300 dark:border-[#ff2d5f]/30'
                              : item.changeType === 'added'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60'
                          }`}
                        >
                          {item.changeType}
                        </span>

                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.task.category}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
                    </div>

                    <div className="flex items-center gap-3 sm:self-center flex-shrink-0">
                      {item.beforeVal && item.afterVal && (
                        <div className="text-xs flex items-center gap-1.5 font-mono bg-white dark:bg-[#020612] px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#142552]">
                          <span className="text-slate-400 line-through">{item.beforeVal}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {item.afterVal}
                          </span>
                        </div>
                      )}

                      {ownerNames && (
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-800/70 px-2.5 py-0.5 rounded border border-transparent dark:border-slate-700">
                          {ownerNames}
                        </span>
                      )}

                      {onNavigateToReport && (
                        <button
                          type="button"
                          onClick={() => onNavigateToReport(feedDate, 'EVENING')}
                          className="text-xs text-[#ff2d5f] hover:text-rose-400 font-bold hover:underline cursor-pointer"
                        >
                          View Table →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
