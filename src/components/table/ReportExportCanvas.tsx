import React from 'react';
import { createPortal } from 'react-dom';
import { AppMetadata, ReportSnapshot, TableDensity } from '../../types';
import { calculateDaysOverdue, getAgingStyle } from '../../utils/aging';
import { formatDateSafe } from '../../utils/date';
import { cn } from '../../utils/cn';

interface ReportExportCanvasProps {
  report: ReportSnapshot;
  metadata: AppMetadata;
  containerRef: React.RefObject<HTMLDivElement>;
  isExporting: boolean;
  density?: TableDensity;
}

export const ReportExportCanvas: React.FC<ReportExportCanvasProps> = ({
  report,
  metadata,
  containerRef,
  isExporting,
  density = 'compact',
}) => {
  const tasks = report.tasks || [];
  const isConfidenceVisible = metadata.columns?.find((c) => c.key === 'confidencePct')?.visible ?? true;
  const visibleCustomCols = (metadata.columns || [])
    .filter((c) => c.isCustom && c.visible)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const totalCols = (isConfidenceVisible ? 7 : 6) + visibleCustomCols.length;

  const cleanedTagline = React.useMemo(() => {
    const raw = (metadata.branding?.teamTagline || '').trim();
    const clean = raw
      .replace(/daily[\s-_]*task[\s-_]*tracker/gi, '')
      .split(/[•\-–:|]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' • ');
    return clean;
  }, [metadata.branding?.teamTagline]);

  const extraWidth = visibleCustomCols.length * 125;
  const containerWidthPx = 1360 + extraWidth;
  const tableWidthPx = 1304 + extraWidth;

  // Density padding classes for pixel-perfect exported image
  const pyClass = density === 'spacious' ? 'py-3' : density === 'comfortable' ? 'py-2' : 'py-1';
  const textClass = density === 'spacious' ? 'text-xs' : density === 'comfortable' ? 'text-xs' : 'text-[11px]';

  // Group tasks by metadata sections
  const groupedSections = metadata.sections
    .map((sec) => {
      const secTasks = tasks
        .filter((t) => t.sectionId === sec.id)
        .sort((a, b) => a.order - b.order);
      return { section: sec, tasks: secTasks };
    })
    .filter((g) => g.tasks.length > 0);

  // Orphan tasks (if any)
  const orphanTasks = tasks.filter(
    (t) => !metadata.sections.some((s) => s.id === t.sectionId)
  );

  const completedCount = tasks.filter((t) => t.completionPct === 100).length;
  const overdueCount = tasks.filter((t) => {
    const d = calculateDaysOverdue(t.etaDate, report.date);
    return d > 0 && t.completionPct < 100;
  }).length;

  const getColLabel = (key: string, fallback: string) => {
    const col = metadata.columns?.find((c) => c.key === key);
    if (!col) return fallback;
    if (col.customLabel && col.customLabel !== col.defaultLabel && col.customLabel !== 'Category') {
      return col.customLabel;
    }
    if (col.defaultLabel === 'Category') {
      return fallback;
    }
    return col.customLabel || col.defaultLabel || fallback;
  };

  const content = (
    <div
      ref={containerRef}
      id="report-export-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: isExporting ? '0px' : '-99999px',
        width: `${containerWidthPx}px`,
        minWidth: `${containerWidthPx}px`,
        maxWidth: `${containerWidthPx}px`,
        backgroundColor: '#FFFFFF',
        zIndex: isExporting ? 99999 : -99999,
        pointerEvents: 'none',
        overflow: 'visible',
        boxSizing: 'border-box',
        padding: '28px',
        opacity: isExporting ? 1 : 0,
        margin: 0,
        fontFamily: '"Google Sans", sans-serif',
      }}
      className="bg-white font-sans text-slate-900"
    >
      {/* 1. Header Banner */}
      <div className="mb-5 pb-4 border-b-2 border-slate-300 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {metadata.branding?.showInExport && metadata.branding?.companyName
                ? metadata.branding.companyName
                : 'Daily Task Tracker'}
            </h1>
            <span
              className={cn(
                'px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider border shadow-2xs',
                report.slot === 'MORNING'
                  ? 'bg-rose-50 text-rose-900 border-rose-200'
                  : 'bg-purple-50 text-purple-900 border-purple-200'
              )}
            >
              {report.slot} SNAPSHOT
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium mt-1">
            {cleanedTagline ? `${cleanedTagline} • ` : ''}Date:{' '}
            <strong className="text-slate-900">{formatDateSafe(report.date, 'EEEE, dd MMMM yyyy')}</strong>
          </p>
        </div>

        {/* Summary Badges */}
        <div className="flex items-center gap-2.5 text-xs font-bold">
          <div className="px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-300 text-slate-800">
            Total Tasks: <span className="font-mono text-slate-950 font-black ml-1">{tasks.length}</span>
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-300 text-emerald-900">
            Completed: <span className="font-mono text-emerald-950 font-black ml-1">{completedCount}</span>
          </div>
          {overdueCount > 0 && (
            <div className="px-3 py-1.5 bg-rose-50 rounded-lg border border-rose-300 text-rose-900">
              Overdue: <span className="font-mono text-rose-950 font-black ml-1">{overdueCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Entire Table Content */}
      <table
        className="text-left spreadsheet-grid border-collapse"
        style={{
          tableLayout: 'fixed',
          width: `${tableWidthPx}px`,
          minWidth: `${tableWidthPx}px`,
          maxWidth: `${tableWidthPx}px`,
          border: '1px solid #cbd5e1',
          borderCollapse: 'collapse',
          boxSizing: 'border-box',
          overflow: 'visible',
        }}
      >
        <colgroup>
          <col style={{ width: visibleCustomCols.length > 0 ? '22%' : (isConfidenceVisible ? '25%' : '26.25%') }} /> {/* Tasks */}
          <col style={{ width: isConfidenceVisible ? '10.5%' : '13%' }} />   {/* Completion % */}
          {isConfidenceVisible && <col style={{ width: '10.5%' }} />}       {/* Confidence % */}
          <col style={{ width: isConfidenceVisible ? '8.8%' : '10.7%' }} />  {/* Owner */}
          <col style={{ width: isConfidenceVisible ? '8.4%' : '10.2%' }} />  {/* ETA */}
          <col style={{ width: isConfidenceVisible ? '8.8%' : '10.7%' }} />  {/* Status */}
          <col style={{ width: visibleCustomCols.length > 0 ? '22%' : (isConfidenceVisible ? '25%' : '26.25%') }} /> {/* Blockers / Notes */}
          {visibleCustomCols.map((col) => (
            <col
              key={col.id}
              style={{
                width: col.width || (col.type === 'link' ? '8%' : col.type === 'number' ? '5%' : '6%'),
              }}
            />
          ))}
        </colgroup>

        <thead>
          <tr className="bg-slate-200 text-slate-950 font-black uppercase tracking-tight text-[10px]">
            <th className={cn('px-3 py-2 border border-slate-300 text-left whitespace-nowrap', pyClass)}>
              {getColLabel('category', 'Tasks')}
            </th>
            <th className={cn('px-0.5 py-2 text-center border border-slate-300 whitespace-nowrap tracking-tight', pyClass)}>
              <span className="whitespace-nowrap inline-block tracking-tight" title={getColLabel('completionPct', 'Completion %')}>
                {getColLabel('completionPct', 'Completion %')}
              </span>
            </th>
            {isConfidenceVisible && (
              <th className={cn('px-0.5 py-2 text-center border border-slate-300 whitespace-nowrap tracking-tight', pyClass)}>
                <span className="whitespace-nowrap inline-block tracking-tight" title={getColLabel('confidencePct', 'Confidence %')}>
                  {getColLabel('confidencePct', 'Confidence %')}
                </span>
              </th>
            )}
            <th className={cn('px-2 py-2 border border-slate-300 text-left whitespace-nowrap', pyClass)}>
              {getColLabel('owner', 'Owner')}
            </th>
            <th className={cn('px-1 py-2 text-center border border-slate-300 whitespace-nowrap', pyClass)}>
              {getColLabel('etaDate', 'ETA')}
            </th>
            <th className={cn('px-1.5 py-2 text-center border border-slate-300 whitespace-nowrap', pyClass)}>
              {getColLabel('status', 'Status')}
            </th>
            <th className={cn('px-3 py-2 border border-slate-300 text-left whitespace-nowrap', pyClass)}>
              {getColLabel('notes', 'Blockers / Notes')}
            </th>
            {visibleCustomCols.map((col) => (
              <th
                key={col.id}
                className={cn('px-2 py-2 text-center border border-slate-300 text-[#ff2d5f] font-black whitespace-nowrap', pyClass)}
              >
                {col.customLabel || col.defaultLabel}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {groupedSections.map(({ section, tasks: secTasks }) => (
            <React.Fragment key={section.id}>
              {/* Section Sub-Header Row - Matches Onscreen Style */}
              <tr className="bg-rose-50/90 border-l-4 border-l-[#ff2d5f] border-y border-slate-300">
                <td
                  colSpan={totalCols}
                  className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-900 border border-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#ff2d5f]" />
                      {section.title}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200">
                      {secTasks.length} {secTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                </td>
              </tr>

              {secTasks.map((task) => {
                const statusConfig = metadata.statuses.find((s) => s.id === task.statusId);
                const isCompleted = statusConfig?.isCompletedState || task.completionPct === 100;

                const daysOverdue = calculateDaysOverdue(task.etaDate, report.date, metadata.agingRules);
                const etaAgingStyle = getAgingStyle(
                  daysOverdue,
                  isCompleted,
                  metadata.agingRules,
                  '#DCFCE7',
                  '#166534'
                );

                const statusBg = task.customStatus ? task.customStatus.bgColor : statusConfig?.bgColor || '#FFFFFF';
                const statusText = task.customStatus ? task.customStatus.textColor : statusConfig?.textColor || '#0F172A';
                const statusLabel = task.customStatus ? task.customStatus.label : statusConfig?.label || (task.statusId || 'No Status');

                const resolvedOwners = task.ownerIds
                  .map((id) => metadata.owners.find((o) => o.id === id))
                  .filter(Boolean);
                const ownersDisplayText =
                  task.customOwnerText ||
                  (resolvedOwners.length > 0 ? resolvedOwners.map((o) => o?.name).join(', ') : 'Unassigned');

                return (
                  <tr
                    key={task.id}
                    className={cn(
                      'border border-slate-300',
                      isCompleted ? 'bg-emerald-50/20' : 'bg-white'
                    )}
                  >
                    {/* Category */}
                    <td className={cn('px-3 text-slate-900 border border-slate-300 align-middle break-words', pyClass, textClass)}>
                      <span className="font-semibold leading-relaxed block">{task.category}</span>
                    </td>

                    {/* Completion % */}
                    <td
                      className={cn(
                        'p-0 text-center font-bold border border-slate-300 align-middle font-mono',
                        isCompleted ? 'bg-[#DCFCE7] text-[#166534]' : 'text-slate-900'
                      )}
                    >
                      <span className={cn('block py-1', textClass)}>{task.completionPct}%</span>
                    </td>

                    {/* Confidence % (Optional) */}
                    {isConfidenceVisible && (
                      <td
                        className={cn(
                          'p-0 text-center font-bold border border-slate-300 align-middle font-mono',
                          isCompleted ? 'bg-[#DCFCE7] text-[#166534]' : 'text-slate-900'
                        )}
                      >
                        <span className={cn('block py-1', textClass)}>{task.confidencePct}%</span>
                      </td>
                    )}

                    {/* Owner */}
                    <td className={cn('px-2.5 font-semibold text-slate-900 border border-slate-300 align-middle break-words', pyClass, textClass)}>
                      <span className="block">{ownersDisplayText}</span>
                    </td>

                    {/* ETA with Aging Heatmap */}
                    <td
                      className={cn('px-1.5 text-center border border-slate-300 align-middle transition-colors font-medium', pyClass, textClass)}
                      style={{
                        backgroundColor: etaAgingStyle.bgColor,
                        color: etaAgingStyle.textColor,
                        fontWeight: etaAgingStyle.isBold ? 700 : 500,
                      }}
                    >
                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span>{formatDateSafe(task.etaDate, 'dd-MMM-yyyy')}</span>
                        {daysOverdue > 0 && !isCompleted && (
                          <span className="text-[10px] opacity-90 font-mono font-bold">
                            (+{daysOverdue}d)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status - Fully Covered Color Cell */}
                    <td
                      className={cn('p-0 border border-slate-300 align-middle text-center', textClass)}
                      style={{ backgroundColor: statusBg }}
                    >
                      <div
                        className="w-full h-full min-h-[32px] flex items-center justify-center px-2 font-bold text-[11px]"
                        style={{ backgroundColor: statusBg, color: statusText }}
                      >
                        {statusLabel}
                      </div>
                    </td>

                    {/* Blockers / Notes */}
                    <td className={cn('px-2.5 border border-slate-300 align-middle break-words', pyClass, textClass)}>
                      <span
                        className={cn(
                          'leading-relaxed text-slate-800 block break-words',
                          task.highlightNotesBold ? 'font-bold text-slate-950' : 'font-medium'
                        )}
                      >
                        {task.notes || '—'}
                      </span>
                    </td>

                    {/* Dynamic Custom Columns Cells */}
                    {visibleCustomCols.map((col) => {
                      const val = (task.customFieldValues && task.customFieldValues[col.key]) || '';
                      return (
                        <td key={col.id} className={cn('px-2.5 border border-slate-300 align-middle', pyClass, textClass)}>
                          {col.type === 'link' ? (
                            val ? (
                              <span className="text-[#ff2d5f] font-mono text-[11px] truncate block font-semibold">
                                {val.replace(/^https?:\/\/(www\.)?/, '')}
                              </span>
                            ) : (
                              <span className="text-slate-400 block text-center">—</span>
                            )
                          ) : col.type === 'tag' ? (
                            val ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                                {val}
                              </span>
                            ) : (
                              <span className="text-slate-400 block text-center">—</span>
                            )
                          ) : col.type === 'number' ? (
                            <span className="block text-center font-mono font-bold text-slate-900">
                              {val !== '' ? val : '—'}
                            </span>
                          ) : (
                            <span className="text-slate-900 block truncate" title={val}>
                              {val || '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}

          {/* Orphan tasks (if any) */}
          {orphanTasks.length > 0 && (
            <React.Fragment>
              <tr className="bg-rose-50/90 border-l-4 border-l-[#ff2d5f] border-y border-slate-300">
                <td
                  colSpan={totalCols}
                  className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-900 border border-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#ff2d5f]" />
                      General Tasks
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 bg-white/70 px-2 py-0.5 rounded-full border border-slate-200">
                      {orphanTasks.length} {orphanTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                </td>
              </tr>
              {orphanTasks.map((task) => {
                const statusConfig = metadata.statuses.find((s) => s.id === task.statusId);
                const isCompleted = statusConfig?.isCompletedState || task.completionPct === 100;
                const daysOverdue = calculateDaysOverdue(task.etaDate, report.date, metadata.agingRules);
                const etaAgingStyle = getAgingStyle(
                  daysOverdue,
                  isCompleted,
                  metadata.agingRules,
                  '#DCFCE7',
                  '#166534'
                );
                const statusBg = task.customStatus ? task.customStatus.bgColor : statusConfig?.bgColor || '#FFFFFF';
                const statusText = task.customStatus ? task.customStatus.textColor : statusConfig?.textColor || '#0F172A';
                const statusLabel = task.customStatus ? task.customStatus.label : statusConfig?.label || (task.statusId || 'No Status');

                return (
                  <tr key={task.id} className={cn('border border-slate-300', isCompleted ? 'bg-emerald-50/20' : 'bg-white')}>
                    <td className={cn('px-3 text-slate-900 border border-slate-300 align-middle break-words', pyClass, textClass)}>
                      <span className="font-semibold leading-relaxed block">{task.category}</span>
                    </td>
                    <td
                      className={cn(
                        'p-0 text-center font-bold border border-slate-300 align-middle font-mono',
                        isCompleted ? 'bg-[#DCFCE7] text-[#166534]' : 'text-slate-900'
                      )}
                    >
                      <span className={cn('block py-1', textClass)}>{task.completionPct}%</span>
                    </td>
                    {isConfidenceVisible && (
                      <td
                        className={cn(
                          'p-0 text-center font-bold border border-slate-300 align-middle font-mono',
                          isCompleted ? 'bg-[#DCFCE7] text-[#166534]' : 'text-slate-900'
                        )}
                      >
                        <span className={cn('block py-1', textClass)}>{task.confidencePct}%</span>
                      </td>
                    )}
                    <td className={cn('px-2.5 font-semibold text-slate-900 border border-slate-300 align-middle break-words', pyClass, textClass)}>
                      <span className="block">{task.customOwnerText || 'Unassigned'}</span>
                    </td>
                    <td
                      className={cn('px-1.5 text-center border border-slate-300 align-middle transition-colors font-medium', pyClass, textClass)}
                      style={{
                        backgroundColor: etaAgingStyle.bgColor,
                        color: etaAgingStyle.textColor,
                        fontWeight: etaAgingStyle.isBold ? 700 : 500,
                      }}
                    >
                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span>{formatDateSafe(task.etaDate, 'dd-MMM-yyyy')}</span>
                        {daysOverdue > 0 && !isCompleted && (
                          <span className="text-[10px] opacity-90 font-mono font-bold">
                            (+{daysOverdue}d)
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={cn('p-0 border border-slate-300 align-middle text-center', textClass)}
                      style={{ backgroundColor: statusBg }}
                    >
                      <div
                        className="w-full h-full min-h-[32px] flex items-center justify-center px-2 font-bold text-[11px]"
                        style={{ backgroundColor: statusBg, color: statusText }}
                      >
                        {statusLabel}
                      </div>
                    </td>
                    <td className={cn('px-2.5 border border-slate-300 align-middle break-words', pyClass, textClass)}>
                      <span className={cn('block leading-relaxed', task.highlightNotesBold ? 'font-bold text-slate-950' : 'font-medium')}>
                        {task.notes || '—'}
                      </span>
                    </td>
                    {visibleCustomCols.map((col) => {
                      const val = (task.customFieldValues && task.customFieldValues[col.key]) || '';
                      return (
                        <td key={col.id} className={cn('px-2.5 border border-slate-300 align-middle', pyClass, textClass)}>
                          <span className="text-slate-900 block truncate">{val || '—'}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </React.Fragment>
          )}
        </tbody>
      </table>

      {/* 3. Footer Stamp */}
      <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <span>Confidential Team Status Report • Snapshot ID: {report.id}</span>
        <span className="font-semibold text-slate-700">{metadata.branding?.companyName || 'Daily Task Tracker'} • Developed by Sakkeer (Lead Mobile Engineer)</span>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
