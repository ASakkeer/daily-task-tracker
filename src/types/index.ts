export type ReportSlot = 'MORNING' | 'AFTERNOON' | 'EVENING';

export interface StatusItem {
  id: string;
  label: string;
  bgColor: string;
  textColor: string;
  isCompletedState: boolean;
  order: number;
}

export interface OwnerItem {
  id: string;
  name: string;
  role?: string;
  avatarColor: string;
}

export interface SectionItem {
  id: string;
  title: string;
  order: number;
  isBugSection?: boolean;
}

export interface NoteTemplateItem {
  id: string;
  label: string;
  templateText: string;
  isBold: boolean;
}

export interface AgingThreshold {
  id: string;
  minDays: number;
  maxDays: number | null; // null represents + (infinity)
  label: string;
  bgColor: string;
  textColor: string;
  isBold?: boolean;
}

export interface AgingRulesConfig {
  thresholds: AgingThreshold[];
  freezeAgingOnComplete: boolean;
  excludeWeekends?: boolean;
  gracePeriodDays?: number;
}

export interface StudioBranding {
  companyName: string;
  teamTagline: string;
  showInExport: boolean;
}

export type CustomColumnType = 'text' | 'link' | 'number' | 'tag';

export interface ColumnConfig {
  id: string;
  key: string;
  defaultLabel: string;
  customLabel: string;
  visible: boolean;
  isOptional: boolean;
  isCustom?: boolean;
  type?: CustomColumnType;
  width?: string;
  order?: number;
}

export interface EodDigestConfig {
  enabled: boolean;
  webhookUrl: string;
  channelName?: string;
  format: 'markdown' | 'compact' | 'json';
  autoDispatchOnSlotClose?: boolean;
  lastDispatchedAt?: string;
}

export type TableDensity = 'compact' | 'comfortable' | 'spacious';

export interface AppMetadata {
  id: string; // 'current_metadata'
  statuses: StatusItem[];
  owners: OwnerItem[];
  sections: SectionItem[];
  noteTemplates: NoteTemplateItem[];
  agingRules: AgingRulesConfig;
  branding: StudioBranding;
  columns: ColumnConfig[];
  eodDigest?: EodDigestConfig;
  backlogConfig?: BacklogConfig;
  updatedAt: string;
}

export interface CustomStatus {
  label: string;
  bgColor: string;
  textColor: string;
}

export interface TaskRow {
  id: string;
  sectionId: string;
  order: number;
  category: string;
  completionPct: number;
  confidencePct: number;
  ownerIds: string[];
  customOwnerText?: string;
  etaDate: string; // "YYYY-MM-DD"
  statusId: string;
  customStatus?: CustomStatus;
  notes: string;
  highlightNotesBold: boolean;
  customFieldValues?: Record<string, string>;
  previousCompletionPct?: number;
  previousConfidencePct?: number;
}

export interface ReportSnapshot {
  id: string; // e.g. "2026-11-14_MORNING"
  date: string; // "YYYY-MM-DD"
  slot: ReportSlot;
  createdAt: string;
  updatedAt: string;
  tasks: TaskRow[];
  previousSlotSnapshotId?: string;
}

export type ActiveView = 'dashboard' | 'report_builder' | 'calendar' | 'metadata' | 'backlog' | 'backup_restore' | 'audit_log';

export type BacklogPriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW' | 'P0' | 'P1' | 'P2' | 'P3' | string;

export type BacklogType = 'feature' | 'bug' | 'tech_debt' | 'spike' | 'improvement';

export type BacklogStatus =
  | 'backlog'
  | 'ready_for_dev'
  | 'in_progress'
  | 'in_review'
  | 'blocked'
  | 'parked'
  | 'completed';

export interface BacklogPriorityConfig {
  id: string; // 'P0', 'P1', 'P2', 'P3'
  label: string; // 'P0', 'P1', etc.
  code: string; // 'P0', 'P1', 'P2', 'P3'
  color: string; // text/dot hex color e.g. '#ff2d5f'
  bgColor: string; // badge background hex e.g. '#ffe4e6'
  order: number;
}

export interface BacklogItem {
  id: string;
  order: number;
  title: string;
  type: BacklogType;
  priority: BacklogPriority;
  status: BacklogStatus;
  storyPoints?: number;
  ownerIds: string[];
  customOwnerText?: string;
  moduleEpic?: string;
  targetSprint?: string;
  targetDate?: string;
  completedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BacklogConfig {
  epics: string[];
  sprints: string[];
  defaultSprint?: string;
  priorities?: BacklogPriorityConfig[];
}

export type AuditActionType =
  | 'task_create'
  | 'task_update'
  | 'status_change'
  | 'completion_update'
  | 'task_delete'
  | 'batch_delete'
  | 'task_reorder'
  | 'rollover'
  | 'export'
  | 'metadata_update'
  | 'backlog_create'
  | 'backlog_update'
  | 'backlog_delete'
  | 'backlog_to_task'
  | 'backlog_reorder'
  | 'backlog_reset'
  | 'system';

export type AuditEntityType = 'task' | 'report' | 'metadata' | 'section' | 'rollover' | 'export' | 'backlog';

export type AuditSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface AuditLogChange {
  field: string;
  fieldLabel?: string;
  from?: string | number | boolean;
  to?: string | number | boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601 string
  actionType: AuditActionType;
  actionLabel: string;
  entityType: AuditEntityType;
  entityId: string;
  entityTitle: string;
  actor: string;
  actorRole?: string;
  actorAvatarColor?: string;
  sectionName?: string;
  details: string;
  changes?: AuditLogChange[];
  severity: AuditSeverity;
}

