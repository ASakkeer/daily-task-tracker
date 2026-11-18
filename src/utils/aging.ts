import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { AgingRulesConfig, AgingThreshold } from '../types';

export const DEFAULT_AGING_THRESHOLDS: AgingThreshold[] = [
  {
    id: 'on_time',
    minDays: 0,
    maxDays: 0,
    label: 'On Time / Future',
    bgColor: '#FFFFFF',
    textColor: '#1E293B',
    isBold: false,
  },
  {
    id: '1_day',
    minDays: 1,
    maxDays: 1,
    label: '1 Day Overdue',
    bgColor: '#FEE2E2',
    textColor: '#991B1B',
    isBold: false,
  },
  {
    id: '2_3_days',
    minDays: 2,
    maxDays: 3,
    label: '2-3 Days Overdue',
    bgColor: '#FCA5A5',
    textColor: '#7F1D1D',
    isBold: false,
  },
  {
    id: '4_6_days',
    minDays: 4,
    maxDays: 6,
    label: '4-6 Days Overdue',
    bgColor: '#F87171',
    textColor: '#7F1D1D',
    isBold: true,
  },
  {
    id: '7_plus_days',
    minDays: 7,
    maxDays: null,
    label: '7+ Days Overdue',
    bgColor: '#DC2626',
    textColor: '#FFFFFF',
    isBold: true,
  },
];

export const DEFAULT_AGING_RULES: AgingRulesConfig = {
  thresholds: DEFAULT_AGING_THRESHOLDS,
  freezeAgingOnComplete: false,
  excludeWeekends: false,
  gracePeriodDays: 0,
};

/**
 * Calculates how many days an ETA date is overdue relative to a report date.
 * If etaDate is 2026-11-10 and reportDate is 2026-11-14, daysOverdue = 4.
 * If etaDate is 2026-11-15, daysOverdue = 0 (not overdue).
 * Optionally excludes weekends and subtracts grace period.
 */
export function calculateDaysOverdue(
  etaDateStr: string,
  reportDateStr: string,
  options?: { excludeWeekends?: boolean; gracePeriodDays?: number }
): number {
  if (!etaDateStr || !reportDateStr) return 0;
  try {
    const eta = parseISO(etaDateStr);
    const reportDate = parseISO(reportDateStr);
    if (!isValid(eta) || !isValid(reportDate)) return 0;
    
    let diff = differenceInCalendarDays(reportDate, eta);
    if (diff <= 0) return 0;

    if (options?.excludeWeekends) {
      let businessDays = 0;
      const curr = new Date(eta);
      curr.setDate(curr.getDate() + 1);
      while (curr <= reportDate) {
        const day = curr.getDay();
        if (day !== 0 && day !== 6) {
          businessDays++;
        }
        curr.setDate(curr.getDate() + 1);
      }
      diff = businessDays;
    }

    if (options?.gracePeriodDays && options.gracePeriodDays > 0) {
      diff = Math.max(0, diff - options.gracePeriodDays);
    }

    return diff;
  } catch {
    return 0;
  }
}

export function getAgingStyle(
  daysOverdue: number,
  isCompleted: boolean,
  agingRules: AgingRulesConfig = DEFAULT_AGING_RULES,
  completedBgColor: string = '#DCFCE7',
  completedTextColor: string = '#166534'
): { bgColor: string; textColor: string; isBold: boolean; daysOverdue: number } {
  // If completed and freezeAgingOnComplete is false, completed color applies
  if (isCompleted && !agingRules.freezeAgingOnComplete) {
    return {
      bgColor: completedBgColor,
      textColor: completedTextColor,
      isBold: false,
      daysOverdue,
    };
  }

  // If not overdue (0 days)
  if (daysOverdue <= 0) {
    const onTimeRule = agingRules.thresholds.find((t) => t.minDays === 0);
    return {
      bgColor: onTimeRule?.bgColor || '#FFFFFF',
      textColor: onTimeRule?.textColor || '#1E293B',
      isBold: onTimeRule?.isBold || false,
      daysOverdue: 0,
    };
  }

  // Find matching threshold
  for (const rule of agingRules.thresholds) {
    if (daysOverdue >= rule.minDays && (rule.maxDays === null || daysOverdue <= rule.maxDays)) {
      return {
        bgColor: rule.bgColor,
        textColor: rule.textColor,
        isBold: rule.isBold ?? false,
        daysOverdue,
      };
    }
  }

  // Fallback to highest threshold or crimson
  return {
    bgColor: '#DC2626',
    textColor: '#FFFFFF',
    isBold: true,
    daysOverdue,
  };
}
