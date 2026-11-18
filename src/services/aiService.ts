import { AppMetadata, ReportSnapshot, TaskRow } from '../types';
import { calculateDaysOverdue } from '../utils/aging';
import { formatDateSafe } from '../utils/date';
import { addDays, format } from 'date-fns';

export interface DailyStandupSummary {
  headline: string;
  markdown: string;
  stats: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    activeBlockers: number;
  };
}

export interface RiskAnalysis {
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  criticalTasks: TaskRow[];
  warnings: string[];
}

/**
 * Generates an executive, beautifully formatted Slack/Teams/Discord Standup Report
 */
export function generateDailyStandup(
  report: ReportSnapshot,
  metadata: AppMetadata,
  previousMorningReport?: ReportSnapshot | null
): DailyStandupSummary {
  const tasks = report.tasks || [];
  const completedTasks = tasks.filter((t) => t.completionPct === 100);
  const inProgressTasks = tasks.filter((t) => t.completionPct > 0 && t.completionPct < 100);
  const notStartedTasks = tasks.filter((t) => t.completionPct === 0);

  const overdueTasks = tasks.filter((t) => {
    const d = calculateDaysOverdue(t.etaDate, report.date);
    return d > 0 && t.completionPct < 100;
  });

  const blockerTasks = tasks.filter(
    (t) => t.statusId === 'status_blocked' || t.highlightNotesBold || (t.notes && t.notes.toLowerCase().includes('block'))
  );

  const getOwnerNames = (t: TaskRow) => {
    if (t.customOwnerText) return t.customOwnerText;
    const resolved = t.ownerIds
      .map((id) => metadata.owners.find((o) => o.id === id)?.name)
      .filter(Boolean);
    return resolved.length > 0 ? resolved.join(', ') : 'Unassigned';
  };

  const formattedDate = formatDateSafe(report.date, 'EEEE, dd MMMM yyyy');

  let md = `*📋 DAILY STANDUP REPORT — ${formattedDate} (${report.slot})*\n`;
  md += `_Generated via ${metadata.branding?.companyName || 'Daily Task Tracker'}_\n\n`;

  md += `*📊 Summary Metrics:*\n`;
  md += `• Total Tasks: *${tasks.length}* | Completed: *${completedTasks.length}* (${tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%) | Overdue: *${overdueTasks.length}*\n\n`;

  if (completedTasks.length > 0) {
    md += `*✅ Done / Completed Today:*\n`;
    completedTasks.forEach((t) => {
      md += `• *${t.category}* — _${getOwnerNames(t)}_\n`;
      if (t.notes) md += `  └ _Note: ${t.notes}_\n`;
    });
    md += `\n`;
  }

  if (inProgressTasks.length > 0) {
    md += `*🔄 In Progress & Active Delivery:*\n`;
    inProgressTasks.forEach((t) => {
      const days = calculateDaysOverdue(t.etaDate, report.date);
      const overdueTag = days > 0 ? ` ⚠️ (+${days}d overdue)` : '';
      md += `• [${t.completionPct}%] *${t.category}* — _${getOwnerNames(t)}_${overdueTag}\n`;
      if (t.notes) md += `  └ _Note: ${t.notes}_\n`;
    });
    md += `\n`;
  }

  if (blockerTasks.length > 0) {
    md += `*🚨 Blockers & Items Needing Discussion:*\n`;
    blockerTasks.forEach((t) => {
      md += `• ⚠️ *${t.category}* (${getOwnerNames(t)})\n`;
      md += `  └ *Blocker:* ${t.notes || 'Status marked as Blocked'}\n`;
    });
    md += `\n`;
  }

  if (notStartedTasks.length > 0) {
    md += `*⏳ Queued / Not Started:*\n`;
    notStartedTasks.slice(0, 5).forEach((t) => {
      md += `• *${t.category}* (${getOwnerNames(t)})\n`;
    });
    if (notStartedTasks.length > 5) {
      md += `• _...and ${notStartedTasks.length - 5} more items queued_\n`;
    }
  }

  return {
    headline: `Standup for ${formattedDate} (${report.slot})`,
    markdown: md.trim(),
    stats: {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      activeBlockers: blockerTasks.length,
    },
  };
}

/**
 * Intelligent Natural Language Parser for Quick Task Creation
 */
export function parseNaturalLanguageTask(
  prompt: string,
  metadata: AppMetadata,
  reportDateStr: string
): Partial<TaskRow> {
  const raw = prompt.trim();
  const lower = raw.toLowerCase();

  // 1. Detect Section (Bug vs Main)
  let sectionId = metadata.sections[0]?.id || '';
  const isBug = lower.includes('bug') || lower.includes('fix') || lower.includes('defect') || lower.includes('issue');
  if (isBug) {
    const bugSec = metadata.sections.find((s) => s.isBugSection);
    if (bugSec) sectionId = bugSec.id;
  }

  // 2. Detect Owner
  const ownerIds: string[] = [];
  for (const owner of metadata.owners) {
    const ownerFirst = owner.name.split(' ')[0].toLowerCase();
    if (lower.includes(ownerFirst) || lower.includes(owner.name.toLowerCase())) {
      ownerIds.push(owner.id);
    }
  }

  // 3. Detect ETA
  let etaDate = reportDateStr;
  if (lower.includes('tomorrow')) {
    etaDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  } else if (lower.includes('next week') || lower.includes('in 7 days')) {
    etaDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  } else if (lower.includes('in 2 days') || lower.includes('2 days')) {
    etaDate = format(addDays(new Date(), 2), 'yyyy-MM-dd');
  }

  // 4. Clean category description
  let cleanedCategory = raw
    .replace(/(tomorrow|today|next week|by friday|by monday)/gi, '')
    .replace(/\s+for\s+[a-zA-Z\s&]+/i, '')
    .trim();

  // If starts with "add" or "create", clean that
  cleanedCategory = cleanedCategory.replace(/^(add|create|log|please add)\s+/i, '');

  if (isBug && !cleanedCategory.toLowerCase().startsWith('bug')) {
    cleanedCategory = `BUG: ${cleanedCategory.charAt(0).toUpperCase() + cleanedCategory.slice(1)}`;
  } else {
    cleanedCategory = cleanedCategory.charAt(0).toUpperCase() + cleanedCategory.slice(1);
  }

  return {
    category: cleanedCategory,
    sectionId,
    ownerIds: ownerIds.length > 0 ? ownerIds : (metadata.owners[0] ? [metadata.owners[0].id] : []),
    etaDate,
    completionPct: 0,
    confidencePct: 90,
    statusId: metadata.statuses.find((s) => s.label === 'Not started')?.id || metadata.statuses[0]?.id || '',
    notes: isBug ? 'Identified in recent test environment build' : '',
    highlightNotesBold: false,
  };
}

/**
 * Export table data to standard CSV format (including custom columns)
 */
export function exportTableAsCsv(report: ReportSnapshot, metadata: AppMetadata): void {
  const tasks = report.tasks || [];
  const customCols = (metadata.columns || []).filter((c) => c.isCustom && c.visible);

  const baseHeaders = ['Section', 'Category', 'Completion %', 'Confidence %', 'Owner', 'ETA', 'Status', 'Blockers / Notes'];
  const customHeaders = customCols.map((c) => c.customLabel || c.defaultLabel);
  const headers = [...baseHeaders, ...customHeaders];

  const rows = tasks.map((t) => {
    const sec = metadata.sections.find((s) => s.id === t.sectionId)?.title || 'General';
    const owners = t.customOwnerText || t.ownerIds.map((id) => metadata.owners.find((o) => o.id === id)?.name).filter(Boolean).join(', ') || 'Unassigned';
    const status = t.customStatus ? t.customStatus.label : metadata.statuses.find((s) => s.id === t.statusId)?.label || t.statusId;

    const baseRow = [
      `"${sec.replace(/"/g, '""')}"`,
      `"${t.category.replace(/"/g, '""')}"`,
      `"${t.completionPct}%"`,
      `"${t.confidencePct}%"`,
      `"${owners.replace(/"/g, '""')}"`,
      `"${t.etaDate}"`,
      `"${status.replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ];

    const customRow = customCols.map((col) => {
      const val = (t.customFieldValues && t.customFieldValues[col.key]) || '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });

    return [...baseRow, ...customRow];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Team-Report-${report.date}-${report.slot}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Dispatches an automated EOD Standup digest to configured Slack/Teams/Discord incoming webhook
 */
export async function dispatchEodWebhook(
  report: ReportSnapshot,
  metadata: AppMetadata,
  overrideUrl?: string,
  overrideFormat?: 'markdown' | 'compact' | 'json'
): Promise<{ success: boolean; message: string }> {
  const url = overrideUrl || metadata.eodDigest?.webhookUrl;
  const formatType = overrideFormat || metadata.eodDigest?.format || 'markdown';

  if (!url || !url.trim()) {
    return {
      success: false,
      message: 'No webhook URL configured. Please configure an incoming webhook in Settings > EOD Digest.',
    };
  }

  const standup = generateDailyStandup(report, metadata);
  let payload: Record<string, any>;

  if (formatType === 'json') {
    payload = {
      event: 'daily_report_digest',
      reportId: report.id,
      date: report.date,
      slot: report.slot,
      stats: standup.stats,
      tasks: (report.tasks || []).map((t) => ({
        id: t.id,
        category: t.category,
        completionPct: t.completionPct,
        confidencePct: t.confidencePct,
        etaDate: t.etaDate,
        status: t.customStatus?.label || metadata.statuses.find((s) => s.id === t.statusId)?.label || t.statusId,
        notes: t.notes,
        customFields: t.customFieldValues || {},
      })),
    };
  } else if (formatType === 'compact') {
    payload = {
      text: `*📋 Standup (${report.date} - ${report.slot})*: ${standup.stats.totalTasks} total, ${standup.stats.completedTasks} completed, ${standup.stats.overdueTasks} overdue. ${standup.stats.activeBlockers} blockers reported.`,
    };
  } else {
    // Markdown format compatible with Slack & Discord webhooks
    payload = {
      text: standup.markdown,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: standup.markdown,
          },
        },
      ],
    };
  }

  try {
    await fetch(url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });

    return {
      success: true,
      message: `Digest dispatched successfully to ${metadata.eodDigest?.channelName || 'configured webhook'}!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to dispatch webhook: ${err.message || 'Network error'}`,
    };
  }
}
