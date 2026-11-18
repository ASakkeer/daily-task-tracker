import { BacklogPriority, BacklogPriorityConfig, BacklogStatus, BacklogType } from '../../types';

export interface OptionConfig<T extends string> {
  value: T;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  icon?: string;
}

export const BACKLOG_PRIORITIES: Record<string, OptionConfig<BacklogPriority>> = {
  P0: {
    value: 'P0',
    label: 'P0',
    badgeBg: 'bg-rose-50 dark:bg-[#ff2d5f]/15',
    badgeText: 'text-rose-700 dark:text-[#ff2d5f]',
    badgeBorder: 'border-rose-200 dark:border-[#ff2d5f]/30',
    dotColor: 'bg-[#ff2d5f]',
  },
  P0_CRITICAL: {
    value: 'P0_CRITICAL',
    label: 'P0',
    badgeBg: 'bg-rose-50 dark:bg-[#ff2d5f]/15',
    badgeText: 'text-rose-700 dark:text-[#ff2d5f]',
    badgeBorder: 'border-rose-200 dark:border-[#ff2d5f]/30',
    dotColor: 'bg-[#ff2d5f]',
  },
  P1: {
    value: 'P1',
    label: 'P1',
    badgeBg: 'bg-amber-50 dark:bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-400',
    badgeBorder: 'border-amber-200 dark:border-amber-500/30',
    dotColor: 'bg-amber-500',
  },
  P1_HIGH: {
    value: 'P1_HIGH',
    label: 'P1',
    badgeBg: 'bg-amber-50 dark:bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-400',
    badgeBorder: 'border-amber-200 dark:border-amber-500/30',
    dotColor: 'bg-amber-500',
  },
  P2: {
    value: 'P2',
    label: 'P2',
    badgeBg: 'bg-blue-50 dark:bg-blue-500/15',
    badgeText: 'text-blue-700 dark:text-blue-400',
    badgeBorder: 'border-blue-200 dark:border-blue-500/30',
    dotColor: 'bg-blue-500',
  },
  P2_MEDIUM: {
    value: 'P2_MEDIUM',
    label: 'P2',
    badgeBg: 'bg-blue-50 dark:bg-blue-500/15',
    badgeText: 'text-blue-700 dark:text-blue-400',
    badgeBorder: 'border-blue-200 dark:border-blue-500/30',
    dotColor: 'bg-blue-500',
  },
  P3: {
    value: 'P3',
    label: 'P3',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  },
  P3_LOW: {
    value: 'P3_LOW',
    label: 'P3',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  },
};

export function getPriorityBadge(
  priority: string,
  customPriorities?: BacklogPriorityConfig[]
): {
  code: string;
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  badgeBorder: string;
} {
  const norm = (priority || '').toUpperCase();
  const code = norm.includes('P0') ? 'P0' : norm.includes('P1') ? 'P1' : norm.includes('P2') ? 'P2' : norm.includes('P3') ? 'P3' : 'P2';

  const custom = customPriorities?.find((p) => p.code === code || p.id === code);
  if (custom) {
    return {
      code,
      label: custom.label || code,
      color: custom.color,
      bgColor: custom.bgColor,
      dotColor: custom.color,
      badgeBorder: custom.color + '40',
    };
  }

  switch (code) {
    case 'P0':
      return {
        code: 'P0',
        label: 'P0',
        color: '#ff2d5f',
        bgColor: '#ffe4e6',
        dotColor: '#ff2d5f',
        badgeBorder: '#fecdd3',
      };
    case 'P1':
      return {
        code: 'P1',
        label: 'P1',
        color: '#d97706',
        bgColor: '#fef3c7',
        dotColor: '#f59e0b',
        badgeBorder: '#fde68a',
      };
    case 'P2':
      return {
        code: 'P2',
        label: 'P2',
        color: '#2563eb',
        bgColor: '#dbeafe',
        dotColor: '#3b82f6',
        badgeBorder: '#bfdbfe',
      };
    case 'P3':
    default:
      return {
        code: 'P3',
        label: 'P3',
        color: '#64748b',
        bgColor: '#f1f5f9',
        dotColor: '#94a3b8',
        badgeBorder: '#e2e8f0',
      };
  }
}

export const BACKLOG_TYPES: Record<BacklogType, OptionConfig<BacklogType>> = {
  feature: {
    value: 'feature',
    label: 'Feature',
    badgeBg: 'bg-purple-50 dark:bg-purple-500/15',
    badgeText: 'text-purple-700 dark:text-purple-400',
    badgeBorder: 'border-purple-200 dark:border-purple-500/30',
    dotColor: 'bg-purple-500',
  },
  bug: {
    value: 'bug',
    label: 'Bug / Defect',
    badgeBg: 'bg-rose-50 dark:bg-rose-500/15',
    badgeText: 'text-rose-700 dark:text-rose-400',
    badgeBorder: 'border-rose-200 dark:border-rose-500/30',
    dotColor: 'bg-rose-500',
  },
  tech_debt: {
    value: 'tech_debt',
    label: 'Tech Debt',
    badgeBg: 'bg-orange-50 dark:bg-orange-500/15',
    badgeText: 'text-orange-700 dark:text-orange-400',
    badgeBorder: 'border-orange-200 dark:border-orange-500/30',
    dotColor: 'bg-orange-500',
  },
  spike: {
    value: 'spike',
    label: 'Research / Spike',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-500/15',
    badgeText: 'text-cyan-700 dark:text-cyan-400',
    badgeBorder: 'border-cyan-200 dark:border-cyan-500/30',
    dotColor: 'bg-cyan-500',
  },
  improvement: {
    value: 'improvement',
    label: 'Improvement',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-400',
    badgeBorder: 'border-emerald-200 dark:border-emerald-500/30',
    dotColor: 'bg-emerald-500',
  },
};

export const BACKLOG_STATUSES: Record<BacklogStatus, OptionConfig<BacklogStatus>> = {
  backlog: {
    value: 'backlog',
    label: 'Backlog',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  },
  ready_for_dev: {
    value: 'ready_for_dev',
    label: 'Ready for Dev',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-500/15',
    badgeText: 'text-indigo-700 dark:text-indigo-400',
    badgeBorder: 'border-indigo-200 dark:border-indigo-500/30',
    dotColor: 'bg-indigo-500',
  },
  in_progress: {
    value: 'in_progress',
    label: 'In Progress',
    badgeBg: 'bg-blue-50 dark:bg-blue-500/15',
    badgeText: 'text-blue-700 dark:text-blue-400',
    badgeBorder: 'border-blue-200 dark:border-blue-500/30',
    dotColor: 'bg-blue-500',
  },
  in_review: {
    value: 'in_review',
    label: 'In Review',
    badgeBg: 'bg-amber-50 dark:bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-400',
    badgeBorder: 'border-amber-200 dark:border-amber-500/30',
    dotColor: 'bg-amber-500',
  },
  blocked: {
    value: 'blocked',
    label: 'Blocked',
    badgeBg: 'bg-rose-50 dark:bg-[#ff2d5f]/15',
    badgeText: 'text-rose-700 dark:text-[#ff2d5f]',
    badgeBorder: 'border-rose-200 dark:border-[#ff2d5f]/30',
    dotColor: 'bg-[#ff2d5f]',
  },
  parked: {
    value: 'parked',
    label: 'Parked',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    badgeBorder: 'border-zinc-300 dark:border-zinc-700',
    dotColor: 'bg-zinc-400',
  },
  completed: {
    value: 'completed',
    label: 'Completed',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-400',
    badgeBorder: 'border-emerald-200 dark:border-emerald-500/30',
    dotColor: 'bg-emerald-500',
  },
};
