import { format, parseISO, isValid } from 'date-fns';

export function formatDateSafe(dateStr: string, formatPattern: string = 'dd-MMM-yyyy'): string {
  if (!dateStr) return '';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, formatPattern);
  } catch {
    return dateStr;
  }
}

export function getTodayDateStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatReportTitle(dateStr: string, slot: string): string {
  const formattedDate = formatDateSafe(dateStr, 'dd MMM yyyy');
  return `Daily Status Report - ${formattedDate} (${slot})`;
}
