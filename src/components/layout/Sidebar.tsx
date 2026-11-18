import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Calendar as CalendarIcon,
  Sliders,
  CheckSquare,
  Sparkles,
  Command,
  X,
  History,
  BookmarkCheck,
  ExternalLink,
  Database,
} from 'lucide-react';
import { ActiveView } from '../../types';
import { cn } from '../../utils/cn';

interface SidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  reportCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  reportCount = 0,
  isMobileOpen = false,
  onCloseMobile,
  onOpenCommandPalette,
}) => {
  const navItems: { id: ActiveView; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    {
      id: 'report_builder',
      label: 'Report Builder Studio',
      icon: FileSpreadsheet,
      badge: 'Live',
    },
    {
      id: 'dashboard',
      label: 'Analytics & KPIs',
      icon: LayoutDashboard,
    },
    {
      id: 'calendar',
      label: 'Monthly Calendar',
      icon: CalendarIcon,
    },
    {
      id: 'metadata',
      label: 'Studio Customization',
      icon: Sliders,
    },
    {
      id: 'backlog',
      label: 'Work Item Backlog',
      icon: BookmarkCheck,
    },
    {
      id: 'backup_restore',
      label: 'Backup & Restore',
      icon: Database,
    },
    {
      id: 'audit_log',
      label: 'Audit Log',
      icon: History,
    },
  ];

  const sidebarContent = (
    <div className="w-64 bg-white dark:bg-[#020612] text-slate-800 dark:text-slate-300 flex flex-col h-full border-r border-slate-200 dark:border-[#142552] select-none shadow-xl lg:shadow-none transition-colors">
      {/* App Branding Header */}
      <div className="p-4 border-b border-slate-200 dark:border-[#142552] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff2d5f] via-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-[#ff2d5f]/25">
            <CheckSquare className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-none flex items-center gap-1.5">
              Daily Task Tracker
              <span className="text-[10px] px-1 py-0.2 rounded bg-rose-100 dark:bg-[#ff2d5f]/20 text-rose-900 dark:text-[#ff2d5f] font-mono font-bold">
                PRO
              </span>
            </h1>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#ff2d5f] animate-pulse"></span>
              Offline Engine
            </span>
          </div>
        </div>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg lg:hidden transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Command Palette Spotlight Pill */}
      {onOpenCommandPalette && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200/70 dark:bg-[#050c21] dark:hover:bg-[#08122f] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-300 dark:border-[#142552] rounded-xl text-xs font-medium transition-all group hover:border-[#ff2d5f]/40"
          >
            <span className="flex items-center gap-2">
              <Command className="w-3.5 h-3.5 text-[#ff2d5f] group-hover:scale-110 transition-transform" />
              Quick Command
            </span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-[#020612] text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-[#142552] rounded shadow-2xs font-bold">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Core Workspaces
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectView(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group hover:scale-[1.01] active:scale-[0.99]',
                isActive
                  ? 'bg-rose-50 dark:bg-[#ff2d5f]/15 text-rose-950 dark:text-[#ff2d5f] border-l-4 border-[#ff2d5f] shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#08122f]'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive
                      ? 'text-[#ff2d5f]'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-[#ff2d5f]'
                  )}
                />
                <span>{item.label}</span>
              </div>

              {item.badge ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#ff2d5f] text-white font-black uppercase tracking-wider shadow-xs">
                  {item.badge}
                </span>
              ) : item.id === 'calendar' && reportCount > 0 ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200 dark:bg-[#0c1a40] text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-[#142552]">
                  {reportCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Bottom Developer Profile Card */}
      <div className="p-3 bg-slate-50/90 dark:bg-[#020612]/95 m-2 rounded-xl border border-slate-200 dark:border-[#142552] shadow-xs transition-colors">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff2d5f] to-pink-500 text-white flex items-center justify-center font-black text-sm shadow-sm flex-shrink-0">
            S
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-black text-slate-900 dark:text-white block truncate">
              Sakkeer
            </span>
            <span className="text-[10px] text-[#ff2d5f] font-bold block truncate">
              Lead Mobile Engineer
            </span>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-slate-200 dark:border-[#142552] pt-2 text-[10px]">
          {/* LinkedIn Profile */}
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">LinkedIn</span>
            <a
              href="https://www.linkedin.com/in/sakkeer5297"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold hover:underline"
              title="Visit Sakkeer's LinkedIn Profile"
            >
              <span>sakkeer5297</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          {/* Portfolio Status */}
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Portfolio</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[9px] border border-amber-200 dark:border-amber-800/50">
              Under Construction
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block h-full flex-shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
