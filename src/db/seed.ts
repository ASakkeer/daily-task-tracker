import { AppMetadata, AuditLogEntry, BacklogConfig, BacklogItem, BacklogPriorityConfig, ColumnConfig, EodDigestConfig, ReportSnapshot } from '../types';
import { DEFAULT_AGING_RULES } from '../utils/aging';

export const DEFAULT_BACKLOG_PRIORITIES: BacklogPriorityConfig[] = [
  { id: 'P0', label: 'P0', code: 'P0', color: '#ff2d5f', bgColor: '#ffe4e6', order: 0 },
  { id: 'P1', label: 'P1', code: 'P1', color: '#f59e0b', bgColor: '#fef3c7', order: 1 },
  { id: 'P2', label: 'P2', code: 'P2', color: '#3b82f6', bgColor: '#dbeafe', order: 2 },
  { id: 'P3', label: 'P3', code: 'P3', color: '#64748b', bgColor: '#f1f5f9', order: 3 },
];

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'col_category', key: 'category', defaultLabel: 'Tasks', customLabel: 'Tasks', visible: true, isOptional: false, order: 1 },
  { id: 'col_completion', key: 'completionPct', defaultLabel: 'Completion %', customLabel: 'Completion %', visible: true, isOptional: false, order: 2 },
  { id: 'col_confidence', key: 'confidencePct', defaultLabel: 'Confidence %', customLabel: 'Confidence %', visible: true, isOptional: true, order: 3 },
  { id: 'col_owner', key: 'owner', defaultLabel: 'Owner', customLabel: 'Owner', visible: true, isOptional: false, order: 4 },
  { id: 'col_eta', key: 'etaDate', defaultLabel: 'ETA', customLabel: 'ETA', visible: true, isOptional: false, order: 5 },
  { id: 'col_status', key: 'status', defaultLabel: 'Status', customLabel: 'Status', visible: true, isOptional: false, order: 6 },
  { id: 'col_notes', key: 'notes', defaultLabel: 'Blockers / Notes', customLabel: 'Blockers / Notes', visible: true, isOptional: false, order: 7 },
];

export const DEFAULT_BRANDING = {
  companyName: 'Daily Task Tracker',
  teamTagline: 'Engineering & QA Workspace',
  showInExport: true,
};

export const DEFAULT_EOD_DIGEST: EodDigestConfig = {
  enabled: false,
  webhookUrl: '',
  channelName: '',
  format: 'markdown',
  autoDispatchOnSlotClose: false,
};

export const DEFAULT_BACKLOG_CONFIG: BacklogConfig = {
  epics: [],
  sprints: [],
  defaultSprint: '',
  priorities: DEFAULT_BACKLOG_PRIORITIES,
};

export const SEED_METADATA: AppMetadata = {
  id: 'current_metadata',
  statuses: [],
  owners: [],
  sections: [],
  noteTemplates: [],
  agingRules: DEFAULT_AGING_RULES,
  branding: DEFAULT_BRANDING,
  columns: DEFAULT_COLUMNS,
  eodDigest: DEFAULT_EOD_DIGEST,
  backlogConfig: DEFAULT_BACKLOG_CONFIG,
  updatedAt: new Date().toISOString(),
};

export function generateSeedReports(): ReportSnapshot[] {
  return [];
}

export function generateSeedAuditLogs(): AuditLogEntry[] {
  return [];
}

export function generateSeedBacklogItems(): BacklogItem[] {
  return [];
}
