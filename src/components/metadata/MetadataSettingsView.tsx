import React, { useState } from 'react';
import { AppMetadata } from '../../types';
import { db, logActivity } from '../../db';
import {
  Tag,
  Users,
  Layers,
  FileText,
  Clock,
  Database,
  Check,
  Columns3,
  Building2,
  Send,
  Milestone,
} from 'lucide-react';
import { StatusManager } from './StatusManager';
import { OwnerManager } from './OwnerManager';
import { SectionManager } from './SectionManager';
import { NoteSnippetsManager } from './NoteSnippetsManager';
import { AgingRulesManager } from './AgingRulesManager';
import { ColumnManager } from './ColumnManager';
import { BrandingManager } from './BrandingManager';
import { EodDigestManager } from './EodDigestManager';
import { BacklogSettingsManager } from './BacklogSettingsManager';
import { BackupRestoreManager } from './BackupRestoreManager';
import { cn } from '../../utils/cn';
import { DEFAULT_BRANDING, DEFAULT_COLUMNS } from '../../db/seed';

interface MetadataSettingsViewProps {
  metadata: AppMetadata;
  onMetadataUpdated: () => void;
}

type TabKey = 'statuses' | 'owners' | 'sections' | 'snippets' | 'columns' | 'branding' | 'aging' | 'eod' | 'backlog_config' | 'backup';

export const MetadataSettingsView: React.FC<MetadataSettingsViewProps> = ({
  metadata,
  onMetadataUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('statuses');
  const [localMeta, setLocalMeta] = useState<AppMetadata>({
    ...metadata,
    branding: metadata.branding || DEFAULT_BRANDING,
    columns: metadata.columns || DEFAULT_COLUMNS,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync if external metadata changes (e.g. on restore)
  React.useEffect(() => {
    setLocalMeta({
      ...metadata,
      branding: metadata.branding || DEFAULT_BRANDING,
      columns: metadata.columns || DEFAULT_COLUMNS,
    });
  }, [metadata]);

  const saveToDb = async (updated: AppMetadata) => {
    setLocalMeta(updated);
    await db.metadata.put({
      ...updated,
      updatedAt: new Date().toISOString(),
    });
    onMetadataUpdated();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);

    logActivity({
      actionType: 'metadata_update',
      actionLabel: 'Studio Settings Updated',
      entityType: 'metadata',
      entityId: 'current_metadata',
      entityTitle: `Studio Customization (${activeTab.toUpperCase()})`,
      actor: metadata.owners?.[0]?.name || 'Workspace Admin',
      actorRole: metadata.owners?.[0]?.role || 'Team Lead',
      details: `Saved changes to ${activeTab} configuration in Studio Customization`,
      severity: 'info',
    });
  };

  const tabs: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'statuses', label: 'Statuses & Colors', icon: Tag },
    { key: 'owners', label: 'Team Owners', icon: Users },
    { key: 'sections', label: 'Sections', icon: Layers },
    { key: 'snippets', label: 'Note Snippets', icon: FileText },
    { key: 'columns', label: 'Columns & Labels', icon: Columns3 },
    { key: 'branding', label: 'Studio Branding', icon: Building2 },
    { key: 'aging', label: 'ETA Aging Rules', icon: Clock },
    { key: 'eod', label: 'EOD Webhook Digest', icon: Send },
    { key: 'backlog_config', label: 'Backlog & Sprints', icon: Milestone },
    { key: 'backup', label: 'Backup & Restore', icon: Database },
  ];

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#050c21] px-4 py-3 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <div>
          <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Metadata &amp; Studio Settings</h1>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
            Fully customize status pills, color schemes, team members, section groupings, custom column labels, company branding, and ETA overdue rules without code.
          </p>
        </div>

        {saveSuccess && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-lg animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            Saved to Local Database
          </div>
        )}
      </div>

      {/* Tabs Bar (Sticky, Streamlined) */}
      <div className="sticky top-0 z-20 flex border-b border-slate-200 dark:border-[#142552] bg-white/95 dark:bg-[#050c21]/95 backdrop-blur-md px-2.5 pt-1.5 rounded-xl shadow-md overflow-x-auto no-scrollbar gap-1 transition-colors">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer',
                isActive
                  ? 'border-[#ff2d5f] text-rose-950 dark:text-[#ff2d5f] bg-rose-50/80 dark:bg-[#ff2d5f]/15 rounded-t-lg font-black'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-t-lg'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-[#ff2d5f]' : 'text-slate-400 dark:text-slate-500')} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div className="mt-4">
        {activeTab === 'statuses' && (
          <StatusManager
            statuses={localMeta.statuses}
            onChange={(statuses) => saveToDb({ ...localMeta, statuses })}
          />
        )}

        {activeTab === 'owners' && (
          <OwnerManager
            owners={localMeta.owners}
            onChange={(owners) => saveToDb({ ...localMeta, owners })}
          />
        )}

        {activeTab === 'sections' && (
          <SectionManager
            sections={localMeta.sections}
            onChange={(sections) => saveToDb({ ...localMeta, sections })}
          />
        )}

        {activeTab === 'snippets' && (
          <NoteSnippetsManager
            noteTemplates={localMeta.noteTemplates}
            onChange={(noteTemplates) => saveToDb({ ...localMeta, noteTemplates })}
          />
        )}

        {activeTab === 'columns' && (
          <ColumnManager
            columns={localMeta.columns || DEFAULT_COLUMNS}
            onChange={(columns) => saveToDb({ ...localMeta, columns })}
          />
        )}

        {activeTab === 'branding' && (
          <BrandingManager
            branding={localMeta.branding || DEFAULT_BRANDING}
            onChange={(branding) => saveToDb({ ...localMeta, branding })}
          />
        )}

        {activeTab === 'aging' && (
          <AgingRulesManager
            agingRules={localMeta.agingRules}
            onChange={(agingRules) => saveToDb({ ...localMeta, agingRules })}
          />
        )}

        {activeTab === 'eod' && (
          <EodDigestManager
            metadata={localMeta}
            onChange={(eodDigest) => saveToDb({ ...localMeta, eodDigest })}
          />
        )}

        {activeTab === 'backlog_config' && (
          <BacklogSettingsManager
            config={localMeta.backlogConfig}
            onChange={(backlogConfig) => saveToDb({ ...localMeta, backlogConfig })}
          />
        )}

        {activeTab === 'backup' && (
          <BackupRestoreManager onRefreshNeeded={onMetadataUpdated} />
        )}
      </div>
    </div>
  );
};
