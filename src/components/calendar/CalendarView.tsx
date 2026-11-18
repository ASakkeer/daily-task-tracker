import React, { useState, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  Download,
  Plus,
  X,
} from 'lucide-react';
import { AppMetadata, ReportSnapshot, ReportSlot } from '../../types';
import { calculateDaysOverdue } from '../../utils/aging';
import { formatDateSafe } from '../../utils/date';
import { ReportExportCanvas } from '../table/ReportExportCanvas';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { cn } from '../../utils/cn';

interface CalendarViewProps {
  metadata: AppMetadata;
  reports: ReportSnapshot[];
  onOpenInEditor: (date: string, slot: ReportSlot) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  metadata,
  reports,
  onOpenInEditor,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [exportingReport, setExportingReport] = useState<ReportSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const drawerExportRef = useRef<HTMLDivElement>(null);

  // Group reports by date string "YYYY-MM-DD"
  const reportsByDate = useMemo(() => {
    const map = new Map<string, ReportSnapshot[]>();
    reports.forEach((rep) => {
      const existing = map.get(rep.date) || [];
      existing.push(rep);
      map.set(rep.date, existing);
    });
    return map;
  }, [reports]);

  // Calendar dates generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Starting day padding for Sunday-based or Monday-based grid
  const startDayOfWeek = monthStart.getDay(); // 0 is Sunday
  const paddingDays = Array.from({ length: startDayOfWeek });

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    const now = new Date();
    setCurrentMonth(now);
    setSelectedDateStr(format(now, 'yyyy-MM-dd'));
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setIsDrawerOpen(true);
  };

  const handleDownloadPng = async (report: ReportSnapshot) => {
    setExportingReport(report);
    await new Promise((r) => setTimeout(r, 150));

    if (drawerExportRef.current) {
      try {
        const node = drawerExportRef.current;
        const exportWidth = 1360;
        const exportHeight = Math.ceil(node.scrollHeight || node.offsetHeight || 800) + 8;

        const dataUrl = await toPng(node, {
          pixelRatio: 3,
          cacheBust: true,
          backgroundColor: '#FFFFFF',
          width: exportWidth,
          height: exportHeight,
          style: {
            position: 'relative',
            left: '0px',
            top: '0px',
            width: `${exportWidth}px`,
            minWidth: `${exportWidth}px`,
            maxWidth: `${exportWidth}px`,
            height: `${exportHeight}px`,
            boxSizing: 'border-box',
            overflow: 'visible',
            transform: 'none',
            padding: '28px',
            margin: '0px',
          },
        });

        const a = document.createElement('a');
        a.download = `Team-Report-${report.date}-${report.slot}.png`;
        a.href = dataUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err: any) {
        setErrorMessage('Export failed: ' + err.message);
      } finally {
        setExportingReport(null);
      }
    }
  };

  // Selected date reports
  const selectedDateReports = reportsByDate.get(selectedDateStr) || [];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* Calendar Navigation Header (Sticky, Streamlined) */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#050c21]/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-[#ff2d5f]/10 text-rose-700 dark:text-[#ff2d5f] border border-rose-200 dark:border-[#ff2d5f]/25 flex items-center justify-center font-bold shadow-2xs">
            <CalendarIcon className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {format(currentMonth, 'MMMM yyyy')}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Interactive timeline of daily report slots and status snapshots
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-1.5 bg-slate-100 dark:bg-[#08122f] hover:bg-slate-200 dark:hover:bg-[#0c1a40] text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-[#142552]"
          >
            Today
          </button>

          <div className="flex items-center border border-slate-300 dark:border-[#142552] rounded-lg overflow-hidden bg-white dark:bg-[#020612]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#08122f] transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-slate-200 dark:bg-[#142552]" />
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#08122f] transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Full-Screen Calendar Grid */}
      <div className="bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-[#142552] bg-slate-50 dark:bg-[#020612] text-center text-xs font-bold text-slate-700 dark:text-slate-300 py-3 uppercase tracking-wider">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Days Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-[#142552] border-b border-slate-200 dark:border-[#142552]">
          {/* Empty padding cells for start of month */}
          {paddingDays.map((_, i) => (
            <div key={`padding-${i}`} className="min-h-[110px] bg-slate-50/50 dark:bg-[#020612]/50 p-2" />
          ))}

          {/* Actual Month Days */}
          {daysInMonth.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayReports = reportsByDate.get(dateStr) || [];
            const hasMorning = dayReports.some((r) => r.slot === 'MORNING');
            const hasEvening = dayReports.some((r) => r.slot === 'EVENING');

            // Total tasks across latest slot
            const latestSlot = dayReports[dayReports.length - 1];
            const tasksCount = latestSlot?.tasks.length || 0;
            const completedCount = latestSlot?.tasks.filter((t) => t.completionPct === 100).length || 0;
            const overdueCount = latestSlot?.tasks.filter((t) => {
              const d = calculateDaysOverdue(t.etaDate, dateStr);
              return d > 0 && t.completionPct < 100;
            }).length || 0;

            const isCurrentDay = isToday(day);
            const isSelected = selectedDateStr === dateStr;

            return (
              <div
                key={dateStr}
                onClick={() => handleDayClick(dateStr)}
                className={cn(
                  'min-h-[115px] p-2 flex flex-col justify-between cursor-pointer transition-all hover:bg-rose-50/40 dark:hover:bg-[#ff2d5f]/10',
                  isCurrentDay && 'bg-rose-50/20 dark:bg-[#ff2d5f]/5 font-bold',
                  isSelected && 'ring-2 ring-[#ff2d5f] ring-inset bg-rose-50/30 dark:bg-[#ff2d5f]/15'
                )}
              >
                {/* Day Number and Badges */}
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full',
                      isCurrentDay
                        ? 'bg-[#ff2d5f] text-white font-black shadow-xs'
                        : isSelected
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                        : 'text-slate-900 dark:text-slate-200'
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Slot Badges: M, A, E */}
                  <div className="flex items-center gap-1">
                    {hasMorning && (
                      <span
                        className="text-[10px] font-black w-4 h-4 rounded bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-transparent dark:border-blue-800/60 flex items-center justify-center shadow-2xs"
                        title="Morning Report Snapshot"
                      >
                        M
                      </span>
                    )}
                    {hasEvening && (
                      <span
                        className="text-[10px] font-black w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800/60 flex items-center justify-center shadow-2xs"
                        title="Evening Report Snapshot"
                      >
                        E
                      </span>
                    )}
                  </div>
                </div>

                {/* Day Summary Indicators */}
                <div className="mt-2 space-y-1">
                  {dayReports.length > 0 ? (
                    <>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {completedCount}/{tasksCount} Done
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{
                            width: `${tasksCount > 0 ? Math.round((completedCount / tasksCount) * 100) : 0}%`,
                          }}
                        />
                      </div>

                      {overdueCount > 0 && (
                        <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 animate-pulse" />
                          <span>{overdueCount} Overdue</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-300 dark:text-slate-600 italic block pt-2">No Reports</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide-in Day Preview Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col text-slate-900 dark:text-slate-100">
              {/* Drawer Header */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {formatDateSafe(selectedDateStr, 'EEEE, dd MMMM yyyy')}
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedDateReports.length} snapshot{selectedDateReports.length === 1 ? '' : 's'} recorded
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {selectedDateReports.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <CalendarIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No report snapshots created for {selectedDateStr} yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenInEditor(selectedDateStr, 'MORNING');
                        setIsDrawerOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                    >
                      <Plus className="w-4 h-4" />
                      Create Morning Report
                    </button>
                  </div>
                ) : (
                  selectedDateReports.map((report) => {
                    const completed = report.tasks.filter((t) => t.completionPct === 100).length;
                    const overdue = report.tasks.filter((t) => {
                      const d = calculateDaysOverdue(t.etaDate, selectedDateStr);
                      return d > 0 && t.completionPct < 100;
                    }).length;

                    return (
                      <div
                        key={report.id}
                        className="bg-white dark:bg-slate-850/90 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm dark:shadow-md space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              'text-xs font-extrabold uppercase px-2.5 py-1 rounded-md shadow-2xs',
                              report.slot === 'MORNING'
                                ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                                : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                            )}
                          >
                            {report.slot} Report
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            {formatDateSafe(report.updatedAt, 'hh:mm a')}
                          </span>
                        </div>

                        {/* Quick Metrics */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Total Tasks</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{report.tasks.length}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Completed</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{completed}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Overdue</span>
                            <span className={cn('font-bold', overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200')}>
                              {overdue}
                            </span>
                          </div>
                        </div>

                        {/* Task Titles List */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                            Key Tasks in Snapshot:
                          </span>
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {report.tasks.slice(0, 5).map((t) => (
                              <div
                                key={t.id}
                                className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60 px-2 py-1 rounded"
                              >
                                <span className="truncate flex-1 font-medium">{t.category}</span>
                                <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-2">
                                  {t.completionPct}%
                                </span>
                              </div>
                            ))}
                            {report.tasks.length > 5 && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center">
                                + {report.tasks.length - 5} more tasks
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onOpenInEditor(report.date, report.slot);
                              setIsDrawerOpen(false);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.01]"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Open in Editor</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadPng(report)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 rounded-lg text-xs font-bold shadow-2xs transition-colors"
                            title="Download full 3x PNG"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>PNG (3x)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offscreen Canvas for Calendar Drawer Instant PNG Export */}
      {exportingReport && (
        <ReportExportCanvas
          report={exportingReport}
          metadata={metadata}
          containerRef={drawerExportRef}
          isExporting={true}
        />
      )}

      {/* Error / Alert Modal */}
      <ConfirmationModal
        isOpen={Boolean(errorMessage)}
        title="Calendar Notice"
        message={errorMessage || ''}
        confirmText="Acknowledge"
        onConfirm={() => setErrorMessage(null)}
        onCancel={() => setErrorMessage(null)}
        variant="danger"
        isAlertOnly={true}
      />
    </div>
  );
};
