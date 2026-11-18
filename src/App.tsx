import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase } from './db';
import { ActiveView, AppMetadata, ReportSlot, TaskRow } from './types';
import { SEED_METADATA } from './db/seed';
import { useTheme } from './hooks/useTheme';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { ReportBuilderView } from './components/table/ReportBuilderView';
import { DashboardView } from './components/dashboard/DashboardView';
import { CalendarView } from './components/calendar/CalendarView';
import { MetadataSettingsView } from './components/metadata/MetadataSettingsView';
import { AuditLogView } from './components/audit/AuditLogView';
import { BacklogView } from './components/backlog/BacklogView';
import { CommandPalette } from './components/ai/CommandPalette';

function getViewFromUrl(): ActiveView {
  const path = window.location.pathname.toLowerCase().replace(/^\//, '');
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
  const query = new URLSearchParams(window.location.search);
  const viewParam = query.get('view')?.toLowerCase();

  const target = viewParam || hash || path;

  if (target.startsWith('dashboard')) return 'dashboard';
  if (target.startsWith('calendar')) return 'calendar';
  if (target.startsWith('settings') || target.startsWith('metadata')) return 'metadata';
  if (target.startsWith('backlog')) return 'backlog';
  if (target.startsWith('audit') || target.startsWith('logs')) return 'audit_log';
  if (target.startsWith('report') || target === '') return 'report_builder';
  return 'report_builder';
}

function getUrlForView(view: ActiveView): string {
  switch (view) {
    case 'dashboard':
      return '/dashboard';
    case 'calendar':
      return '/calendar';
    case 'metadata':
      return '/settings';
    case 'backlog':
      return '/backlog';
    case 'audit_log':
      return '/audit';
    case 'report_builder':
    default:
      return '/report-builder';
  }
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeView, setActiveView] = useState<ActiveView>(() => getViewFromUrl());
  const [isDbReady, setIsDbReady] = useState(false);
  const [editorContext, setEditorContext] = useState<{
    date: string;
    slot: ReportSlot;
  } | null>(null);

  // Responsive & Modals State
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const handleSelectView = (view: ActiveView, replace = false) => {
    if (view === 'report_builder') {
      setEditorContext(null);
    }
    setActiveView(view);
    const targetUrl = getUrlForView(view);
    if (window.location.pathname !== targetUrl) {
      if (replace) {
        window.history.replaceState({ view }, '', targetUrl);
      } else {
        window.history.pushState({ view }, '', targetUrl);
      }
    }
  };

  useEffect(() => {
    // Sync initial clean URL state
    const currentTarget = getUrlForView(activeView);
    if (window.location.pathname !== currentTarget && !window.location.hash) {
      window.history.replaceState({ view: activeView }, '', currentTarget);
    }

    const onPop = () => {
      setActiveView(getViewFromUrl());
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, [activeView]);

  useEffect(() => {
    initializeDatabase().then(() => {
      setIsDbReady(true);
    });
  }, []);

  const metadata = useLiveQuery(
    async () => {
      const meta = await db.metadata.get('current_metadata');
      return meta || SEED_METADATA;
    },
    [],
    SEED_METADATA
  );

  const reports = useLiveQuery(
    async () => {
      return await db.reports.toArray();
    },
    [],
    []
  );

  const handleNavigateToReport = (date: string, slot: ReportSlot) => {
    setEditorContext({ date, slot });
    handleSelectView('report_builder');
  };

  const latestReport = reports && reports.length > 0 ? reports[reports.length - 1] : null;

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020612] flex flex-col items-center justify-center text-slate-900 dark:text-white ai-gradient-bg">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#ff2d5f]/20 border-t-[#ff2d5f] rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 bg-[#ff2d5f] rounded-full animate-pulse blur-xs" />
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-6 tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ff2d5f] animate-ping" />
          Initializing Daily Task Tracker...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#020612] text-slate-900 dark:text-slate-100 ai-gradient-bg font-sans selection:bg-[#ff2d5f]/30 selection:text-rose-900 dark:selection:text-rose-200">
      {/* Sidebar with Mobile Drawer */}
      <Sidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        reportCount={reports.length}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navigation Bar */}
        <Navbar
          activeView={activeView}
          onOpenMobileMenu={() => setIsMobileNavOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          metadata={metadata as AppMetadata}
        />

        {/* Scrollable Workspace Container (Optimized Padding for High Visibility) */}
        <main className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 lg:p-5 pt-2">
          {activeView === 'report_builder' && (
            <ReportBuilderView
              metadata={metadata as AppMetadata}
              onMetadataUpdated={() => {}}
              initialDate={editorContext?.date}
              initialSlot={editorContext?.slot}
            />
          )}

          {activeView === 'dashboard' && (
            <DashboardView
              metadata={metadata as AppMetadata}
              reports={reports}
              onNavigateToReport={handleNavigateToReport}
            />
          )}

          {activeView === 'calendar' && (
            <CalendarView
              metadata={metadata as AppMetadata}
              reports={reports}
              onOpenInEditor={handleNavigateToReport}
            />
          )}

          {activeView === 'metadata' && (
            <MetadataSettingsView
              metadata={metadata as AppMetadata}
              onMetadataUpdated={() => {}}
            />
          )}

          {activeView === 'backlog' && (
            <BacklogView
              metadata={metadata as AppMetadata}
              onMetadataUpdated={() => {}}
            />
          )}

          {activeView === 'audit_log' && (
            <AuditLogView
              metadata={metadata as AppMetadata}
              onNavigateToReport={handleNavigateToReport}
            />
          )}
        </main>
      </div>

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateView={(view) => {
          handleSelectView(view);
          setIsCommandPaletteOpen(false);
        }}
        onSelectSlot={(slot) => {
          setEditorContext((prev) => ({
            date: prev?.date || new Date().toISOString().split('T')[0],
            slot,
          }));
          handleSelectView('report_builder');
        }}
        onOpenAddTask={() => {
          handleSelectView('report_builder');
          // triggers N key shortcut
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
        }}
        onExportPng={() => {
          handleSelectView('report_builder');
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
        }}
        currentReport={latestReport}
        metadata={metadata as AppMetadata}
      />
    </div>
  );
}
