import React from 'react';
import {
  Menu,
  Search,
  Sparkles,
  Command,
  FileSpreadsheet,
  LayoutDashboard,
  Calendar as CalendarIcon,
  Sliders,
  Sun,
  Moon,
  History,
  BookmarkCheck,
} from 'lucide-react';
import { ActiveView, AppMetadata } from '../../types';
import { ThemeMode } from '../../hooks/useTheme';

interface NavbarProps {
  activeView: ActiveView;
  onOpenMobileMenu: () => void;
  onOpenCommandPalette: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  metadata?: AppMetadata;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onOpenMobileMenu,
  onOpenCommandPalette,
  theme,
  onToggleTheme,
  metadata,
}) => {
  const getViewTitle = () => {
    switch (activeView) {
      case 'report_builder':
        return { title: 'Report Builder Studio', icon: FileSpreadsheet };
      case 'dashboard':
        return { title: 'Analytics & KPIs', icon: LayoutDashboard };
      case 'calendar':
        return { title: 'Reports Timeline', icon: CalendarIcon };
      case 'metadata':
        return { title: 'Studio Customization', icon: Sliders };
      case 'backlog':
        return { title: 'Work Item Backlog', icon: BookmarkCheck };
      case 'audit_log':
        return { title: 'System Audit & Activity Log', icon: History };
      default:
        return { title: 'Report Builder Studio', icon: FileSpreadsheet };
    }
  };

  const { title, icon: ViewIcon } = getViewTitle();

  return (
    <header className="h-14 bg-white/95 dark:bg-[#020612]/95 backdrop-blur-xl border-b border-slate-200 dark:border-[#142552] px-4 md:px-6 flex items-center justify-between z-20 flex-shrink-0 text-slate-900 dark:text-white transition-colors">
      {/* Left: Mobile Toggle & View Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#08122f] rounded-lg lg:hidden transition-colors"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-[#ff2d5f]/10 text-[#ff2d5f] border border-rose-200 dark:border-[#ff2d5f]/20 shadow-2xs hidden sm:block">
            <ViewIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-none">
              {title}
            </h1>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline-block mt-0.5">
              {metadata?.branding?.companyName || 'Daily Task Tracker'}
            </span>
          </div>
        </div>
      </div>

      {/* Center / Right: Command Spotlight, Theme Switcher & AI Triggers */}
      <div className="flex items-center gap-2.5">
        {/* Command Spotlight Button (Cmd+K) */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-[#050c21] hover:bg-slate-200/80 dark:hover:bg-[#08122f] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-medium transition-all border border-slate-300 dark:border-[#142552] shadow-2xs group hover:border-[#ff2d5f]/50"
        >
          <Search className="w-3.5 h-3.5 text-[#ff2d5f] group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">Spotlight search...</span>
          <span className="sm:hidden">Search...</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-mono font-bold bg-white dark:bg-[#020612] text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-[#142552] rounded shadow-2xs">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>

        {/* Theme Switcher Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#050c21] hover:bg-slate-200 dark:hover:bg-[#08122f] border border-slate-300 dark:border-[#142552] rounded-xl transition-all shadow-2xs hover:scale-105 active:scale-95"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-200" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 animate-in spin-in-180 duration-200" />
          )}
        </button>

        {/* Live Engine Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-300 dark:border-emerald-800/50 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Dexie Core</span>
        </div>
      </div>
    </header>
  );
};
