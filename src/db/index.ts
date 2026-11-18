import Dexie, { type EntityTable } from 'dexie';
import { AppMetadata, AuditLogEntry, BacklogItem, ReportSnapshot } from '../types';
import { SEED_METADATA, DEFAULT_BACKLOG_CONFIG, generateSeedReports, generateSeedAuditLogs } from './seed';

export class TaskReportDB extends Dexie {
  metadata!: EntityTable<AppMetadata, 'id'>;
  reports!: EntityTable<ReportSnapshot, 'id'>;
  auditLogs!: EntityTable<AuditLogEntry, 'id'>;
  backlogItems!: EntityTable<BacklogItem, 'id'>;

  constructor() {
    super('TaskReportDB');
    this.version(1).stores({
      metadata: 'id',
      reports: 'id, date, slot, [date+slot], createdAt',
    });
    this.version(2).stores({
      metadata: 'id',
      reports: 'id, date, slot, [date+slot], createdAt',
      auditLogs: 'id, timestamp, actionType, entityType, entityId, actor, severity',
    });
    this.version(3).stores({
      metadata: 'id',
      reports: 'id, date, slot, [date+slot], createdAt',
      auditLogs: 'id, timestamp, actionType, entityType, entityId, actor, severity',
      backlogItems: 'id, order, type, priority, status, targetSprint, createdAt',
    });
  }
}

export const db = new TaskReportDB();

/**
 * Log an action to persistent Dexie database
 */
export async function logActivity(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<void> {
  try {
    const id = entry.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = entry.timestamp || new Date().toISOString();
    await db.auditLogs.put({
      ...entry,
      id,
      timestamp,
    });
  } catch (error) {
    console.warn('Failed to record audit log entry:', error);
  }
}

/**
 * Initializes the database with default seed values on first startup
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Pure clean migration key: wipes all mock data (statuses, owners, sections, templates, reports, logs)
    const DATASET_VERSION_KEY = 'daily_task_tracker_pure_clean_v13';
    const isAlreadyMigrated = localStorage.getItem(DATASET_VERSION_KEY);

    if (!isAlreadyMigrated) {
      await db.transaction('rw', db.metadata, db.reports, db.auditLogs, db.backlogItems, async () => {
        // 1. Clear all reports (clears all tasks, calendar snapshots, analytics & KPIs data)
        await db.reports.clear();

        // 2. Clear all audit logs (ready for real user activity from scratch)
        await db.auditLogs.clear();

        // 3. Clear backlog items (starts with 0 mock data)
        await db.backlogItems.clear();

        // 4. Clear all metadata and replace with clean SEED_METADATA (no mock status, no mock owners, no mock sections, no mock templates)
        await db.metadata.clear();
        await db.metadata.put(SEED_METADATA);
      });

      localStorage.setItem(DATASET_VERSION_KEY, 'true');
      return;
    }

    // Always ensure mock logs are cleaned out if any remain from previous sessions
    await db.auditLogs.where('id').startsWith('audit_seed_').delete();

    // Sanitize any legacy branding tagline in metadata that contains "Daily Task Tracker" to prevent duplicate title
    const existingMeta = await db.metadata.get('current_metadata');
    if (existingMeta) {
      let needsMetaSave = false;
      if (existingMeta.branding?.teamTagline && /daily[\s-_]*task[\s-_]*tracker/i.test(existingMeta.branding.teamTagline)) {
        existingMeta.branding.teamTagline = existingMeta.branding.teamTagline
          .replace(/daily[\s-_]*task[\s-_]*tracker\s*[•\-–:|]?\s*/gi, '')
          .split(/[•\-–:|]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(' • ') || 'Engineering & QA Workspace';
        needsMetaSave = true;
      }
      if (!existingMeta.backlogConfig) {
        existingMeta.backlogConfig = DEFAULT_BACKLOG_CONFIG;
        needsMetaSave = true;
      }
      if (needsMetaSave) {
        await db.metadata.put(existingMeta);
      }
    } else {
      await db.metadata.put(SEED_METADATA);
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

/**
 * Studio Customization JSON Backup Schema
 */
export interface StudioCustomizationBackup {
  type: 'studio_customization';
  version: number;
  appName: string;
  exportedAt: string;
  metadata: AppMetadata;
}

/**
 * Report Builder Studio JSON Backup Schema
 */
export interface ReportBuilderBackup {
  type: 'report_builder_studio';
  version: number;
  appName: string;
  exportedAt: string;
  reportCount: number;
  totalTasks: number;
  reports: ReportSnapshot[];
}

/**
 * Backlog Items JSON Backup Schema
 */
export interface BacklogBackup {
  type: 'backlog_items';
  version: number;
  appName: string;
  exportedAt: string;
  itemCount: number;
  backlogItems: BacklogItem[];
}

/**
 * Full Database JSON Backup Schema
 */
export interface DatabaseBackup {
  type: 'full_workspace';
  version: number;
  appName: string;
  exportedAt: string;
  metadata: AppMetadata;
  reports: ReportSnapshot[];
  auditLogs?: AuditLogEntry[];
  backlogItems?: BacklogItem[];
}

/**
 * 1. Export Studio Customization to JSON
 */
export async function exportStudioCustomizationToJson(): Promise<string> {
  const metadata = (await db.metadata.get('current_metadata')) || SEED_METADATA;

  const backup: StudioCustomizationBackup = {
    type: 'studio_customization',
    version: 1,
    appName: 'Daily Task Tracker',
    exportedAt: new Date().toISOString(),
    metadata,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * 2. Import & Restore Studio Customization from JSON
 */
export async function importStudioCustomizationFromJson(
  jsonContent: string
): Promise<{ success: boolean; error?: string; summary?: string }> {
  try {
    const data = JSON.parse(jsonContent);
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid JSON file: Root must be a valid JSON object.' };
    }

    // Determine metadata object (either data.metadata or root if it has statuses/owners)
    const targetMeta: AppMetadata = data.metadata || data;

    if (!Array.isArray(targetMeta.statuses) || !Array.isArray(targetMeta.owners)) {
      return {
        success: false,
        error: 'Invalid Studio Customization file: Missing required metadata arrays (statuses, team members).',
      };
    }

    if (!Array.isArray(targetMeta.sections)) {
      targetMeta.sections = SEED_METADATA.sections;
    }
    if (!Array.isArray(targetMeta.noteTemplates)) {
      targetMeta.noteTemplates = SEED_METADATA.noteTemplates;
    }
    if (!Array.isArray(targetMeta.columns)) {
      targetMeta.columns = SEED_METADATA.columns;
    }
    if (!targetMeta.agingRules) {
      targetMeta.agingRules = SEED_METADATA.agingRules;
    }
    if (!targetMeta.branding) {
      targetMeta.branding = SEED_METADATA.branding;
    }
    if (!targetMeta.eodDigest) {
      targetMeta.eodDigest = SEED_METADATA.eodDigest;
    }

    targetMeta.id = 'current_metadata';
    targetMeta.updatedAt = new Date().toISOString();

    // Atomic update to metadata ONLY without touching reports/tasks
    await db.transaction('rw', db.metadata, db.auditLogs, async () => {
      await db.metadata.clear();
      await db.metadata.put(targetMeta);
    });

    const summary = `${targetMeta.statuses.length} statuses, ${targetMeta.owners.length} team members, ${targetMeta.sections.length} sections, ${targetMeta.noteTemplates.length} note templates`;

    await logActivity({
      actionType: 'metadata_update',
      actionLabel: 'Studio Customization Restored',
      entityType: 'metadata',
      entityId: 'current_metadata',
      entityTitle: 'Studio Customization Configuration',
      actor: targetMeta.owners?.[0]?.name || 'Workspace Admin',
      actorRole: targetMeta.owners?.[0]?.role || 'Team Lead',
      details: `Restored Studio Customization from JSON backup: ${summary}`,
      severity: 'success',
    });

    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse JSON file' };
  }
}

/**
 * 3. Export Report Builder Studio Tasks to JSON
 */
export async function exportReportBuilderTasksToJson(): Promise<string> {
  const reports = await db.reports.toArray();
  const totalTasks = reports.reduce((acc, r) => acc + (r.tasks?.length || 0), 0);

  const backup: ReportBuilderBackup = {
    type: 'report_builder_studio',
    version: 1,
    appName: 'Daily Task Tracker',
    exportedAt: new Date().toISOString(),
    reportCount: reports.length,
    totalTasks,
    reports,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * 4. Import & Restore Report Builder Studio Tasks from JSON
 */
export async function importReportBuilderTasksFromJson(
  jsonContent: string
): Promise<{ success: boolean; error?: string; summary?: string }> {
  try {
    const data = JSON.parse(jsonContent);
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid JSON file: Root must be a valid JSON object or array.' };
    }

    // Determine reports array (either data.reports, data if array, or single snapshot)
    let reportsToImport: ReportSnapshot[] = [];
    if (Array.isArray(data.reports)) {
      reportsToImport = data.reports;
    } else if (Array.isArray(data)) {
      reportsToImport = data;
    } else if (data.id && data.date && data.slot && Array.isArray(data.tasks)) {
      reportsToImport = [data];
    } else {
      return {
        success: false,
        error: 'Invalid Report Builder file: Missing "reports" array or report snapshot records.',
      };
    }

    // Validate report snapshot structure
    for (const report of reportsToImport) {
      if (!report.id || !report.date || !report.slot || !Array.isArray(report.tasks)) {
        return {
          success: false,
          error: `Invalid report snapshot: Snapshot "${report.id || 'unknown'}" is missing required date, slot, or tasks array.`,
        };
      }
    }

    const totalTasksCount = reportsToImport.reduce((acc, r) => acc + (r.tasks?.length || 0), 0);

    // Atomic update to reports ONLY without touching metadata
    await db.transaction('rw', db.reports, db.auditLogs, async () => {
      await db.reports.clear();
      if (reportsToImport.length > 0) {
        await db.reports.bulkPut(reportsToImport);
      }
    });

    const summary = `${reportsToImport.length} report snapshots, ${totalTasksCount} total tasks`;

    await logActivity({
      actionType: 'task_update',
      actionLabel: 'Report Builder Tasks Restored',
      entityType: 'report',
      entityId: 'report_builder_restore',
      entityTitle: 'Report Builder Studio Tasks',
      actor: 'Workspace Admin',
      actorRole: 'Team Lead',
      details: `Restored Report Builder tasks from JSON backup: ${summary}`,
      severity: 'success',
    });

    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse JSON file' };
  }
}

/**
 * 5. Export Backlog Items to JSON
 */
export async function exportBacklogToJson(): Promise<string> {
  const items = await db.backlogItems.orderBy('order').toArray();
  const backup: BacklogBackup = {
    type: 'backlog_items',
    version: 1,
    appName: 'Daily Task Tracker',
    exportedAt: new Date().toISOString(),
    itemCount: items.length,
    backlogItems: items,
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * 6. Import Backlog Items from JSON
 */
export async function importBacklogFromJson(
  jsonContent: string
): Promise<{ success: boolean; error?: string; summary?: string }> {
  try {
    const data = JSON.parse(jsonContent);
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid JSON file: Root must be an object or array.' };
    }

    let itemsToImport: BacklogItem[] = [];
    if (Array.isArray(data.backlogItems)) {
      itemsToImport = data.backlogItems;
    } else if (Array.isArray(data)) {
      itemsToImport = data;
    } else {
      return {
        success: false,
        error: 'Invalid Backlog backup file: Missing "backlogItems" array.',
      };
    }

    // Validate backlog item structure
    for (const item of itemsToImport) {
      if (!item.id || !item.title) {
        return {
          success: false,
          error: `Invalid backlog item: Item "${item.id || 'unknown'}" is missing required id or title.`,
        };
      }
    }

    await db.transaction('rw', db.backlogItems, db.auditLogs, async () => {
      await db.backlogItems.clear();
      if (itemsToImport.length > 0) {
        await db.backlogItems.bulkPut(itemsToImport);
      }
    });

    const summary = `${itemsToImport.length} work items restored`;
    await logActivity({
      actionType: 'backlog_update',
      actionLabel: 'Backlog Restored',
      entityType: 'backlog',
      entityId: 'backlog_restore',
      entityTitle: 'Sprint & Product Backlog',
      actor: 'Workspace Admin',
      actorRole: 'Team Lead',
      details: `Restored backlog work items from JSON backup: ${summary}`,
      severity: 'success',
    });

    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse JSON file' };
  }
}

/**
 * 7. Full Database JSON Backup
 */
export async function exportDatabaseToJson(): Promise<string> {
  const metadata = (await db.metadata.get('current_metadata')) || SEED_METADATA;
  const reports = await db.reports.toArray();
  const auditLogs = await db.auditLogs.toArray();
  const backlogItems = await db.backlogItems.toArray();

  const backup: DatabaseBackup = {
    type: 'full_workspace',
    version: 3,
    appName: 'Daily Task Tracker',
    exportedAt: new Date().toISOString(),
    metadata,
    reports,
    auditLogs,
    backlogItems,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * 8. Full Database JSON Restore with Schema Validation (Smart Auto-Routing)
 */
export async function importDatabaseFromJson(
  jsonContent: string
): Promise<{ success: boolean; error?: string; summary?: string }> {
  try {
    const data = JSON.parse(jsonContent);

    // Schema Validation
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid JSON file: Root is not an object.' };
    }

    // Smart Routing: If user selected Studio Customization backup into full restore
    if (data.type === 'studio_customization' || (data.metadata && !data.reports)) {
      return importStudioCustomizationFromJson(jsonContent);
    }

    // Smart Routing: If user selected Report Builder tasks backup into full restore
    if (data.type === 'report_builder_studio' || (data.reports && !data.metadata)) {
      return importReportBuilderTasksFromJson(jsonContent);
    }

    // Smart Routing: If user selected Backlog backup into full restore
    if (data.type === 'backlog_items' || (Array.isArray(data.backlogItems) && !data.reports)) {
      return importBacklogFromJson(jsonContent);
    }

    if (!data.metadata || !Array.isArray(data.metadata.statuses) || !Array.isArray(data.metadata.owners)) {
      return { success: false, error: 'Invalid schema: Missing required metadata structures (statuses, owners).' };
    }

    if (!Array.isArray(data.reports)) {
      return { success: false, error: 'Invalid schema: "reports" must be an array.' };
    }

    // Atomic transaction to restore
    await db.transaction('rw', db.metadata, db.reports, db.auditLogs, db.backlogItems, async () => {
      await db.metadata.clear();
      await db.reports.clear();
      await db.auditLogs.clear();
      await db.backlogItems.clear();

      await db.metadata.put({
        ...data.metadata,
        id: 'current_metadata',
        updatedAt: new Date().toISOString(),
      });

      if (data.reports.length > 0) {
        await db.reports.bulkPut(data.reports);
      }

      if (Array.isArray(data.auditLogs) && data.auditLogs.length > 0) {
        await db.auditLogs.bulkPut(data.auditLogs);
      }

      if (Array.isArray(data.backlogItems) && data.backlogItems.length > 0) {
        await db.backlogItems.bulkPut(data.backlogItems);
      }
    });

    const totalTasks = data.reports.reduce((acc: number, r: ReportSnapshot) => acc + (r.tasks?.length || 0), 0);
    const totalBacklog = Array.isArray(data.backlogItems) ? data.backlogItems.length : 0;
    const summary = `Full workspace restored: ${data.reports.length} report snapshots (${totalTasks} tasks), ${totalBacklog} backlog items & Studio Customization`;

    await logActivity({
      actionType: 'system',
      actionLabel: 'Full Workspace Restored',
      entityType: 'metadata',
      entityId: 'full_restore',
      entityTitle: 'Complete Workspace Backup',
      actor: data.metadata?.owners?.[0]?.name || 'Workspace Admin',
      actorRole: data.metadata?.owners?.[0]?.role || 'Team Lead',
      details: summary,
      severity: 'success',
    });

    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse JSON file' };
  }
}

/**
 * Reset database to default initial state
 */
export async function resetDatabaseToDefault(): Promise<void> {
  await db.transaction('rw', db.metadata, db.reports, db.auditLogs, db.backlogItems, async () => {
    await db.metadata.clear();
    await db.reports.clear();
    await db.auditLogs.clear(); // Fresh clean slate
    await db.backlogItems.clear();
    await db.metadata.put(SEED_METADATA);
    await db.reports.bulkPut(generateSeedReports());
  });
}
