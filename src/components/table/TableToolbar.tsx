import React, { useState } from 'react';
import {
  Search,
  RotateCcw,
} from 'lucide-react';
import { AppMetadata, TableDensity } from '../../types';
import { MultiSelectDropdown, MultiSelectOption } from '../common/MultiSelectDropdown';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface TableToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedOwnerFilters: string[];
  onOwnerFiltersChange: (ownerIds: string[]) => void;
  selectedStatusFilters: string[];
  onStatusFiltersChange: (statusIds: string[]) => void;
  showOverdueOnly: boolean;
  onToggleOverdueOnly: () => void;
  onResetFilters: () => void;
  onResetAll?: () => void;
  onResetClick?: () => void;
  hasActiveFilters: boolean;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  metadata: AppMetadata;
  totalTasks: number;
  filteredTasksCount: number;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedOwnerFilters,
  onOwnerFiltersChange,
  selectedStatusFilters,
  onStatusFiltersChange,
  showOverdueOnly,
  onToggleOverdueOnly,
  onResetFilters,
  onResetAll,
  onResetClick,
  hasActiveFilters,
  density,
  onDensityChange,
  metadata,
  totalTasks,
  filteredTasksCount,
}) => {
  const ownerOptions: MultiSelectOption[] = metadata.owners.map((o) => ({
    id: o.id,
    label: o.name,
    avatarColor: o.avatarColor,
  }));

  const statusOptions: MultiSelectOption[] = metadata.statuses.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.bgColor,
    textColor: s.textColor,
  }));

  return (
    <div className="bg-white dark:bg-[#050c21] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl flex flex-wrap items-center justify-between gap-2.5 transition-colors">
      {/* Left: Search & Multiselect Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter tasks or blockers..."
            className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>

        {/* Multiselect Owners Filter */}
        <MultiSelectDropdown
          label="Owners"
          options={ownerOptions}
          selectedIds={selectedOwnerFilters}
          onChange={onOwnerFiltersChange}
          placeholder="All Owners"
        />

        {/* Multiselect Statuses Filter */}
        <MultiSelectDropdown
          label="Statuses"
          options={statusOptions}
          selectedIds={selectedStatusFilters}
          onChange={onStatusFiltersChange}
          placeholder="All Statuses"
        />

        {/* Overdue Only Filter */}
        <button
          type="button"
          onClick={onToggleOverdueOnly}
          className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
            showOverdueOnly
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700/60 shadow-xs'
              : 'bg-slate-50 dark:bg-[#020612] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#142552] hover:bg-slate-100 dark:hover:bg-[#08122f]'
          }`}
        >
          🔥 Overdue Only
        </button>

        {/* Reset Filters Button (Visible when any filter is active) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 rounded-lg transition-all cursor-pointer animate-in fade-in"
            title="Reset all active filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}

        {filteredTasksCount < totalTasks && (
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 self-center pl-1">
            Showing {filteredTasksCount} of {totalTasks}
          </span>
        )}
      </div>

      {/* Right: Density Switcher (1x, 2x, 3x) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Density:
          </span>
          <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-[#020612] rounded-lg border border-slate-200 dark:border-[#142552] text-xs">
            {[
              { id: 'compact' as const, label: '1x', title: 'Compact (1x)' },
              { id: 'comfortable' as const, label: '2x', title: 'Comfortable (2x)' },
              { id: 'spacious' as const, label: '3x', title: 'Spacious (3x)' },
            ].map(({ id, label, title }) => (
              <button
                key={id}
                type="button"
                onClick={() => onDensityChange(id)}
                title={title}
                className={`px-2.5 py-0.5 rounded font-black transition-all cursor-pointer font-mono ${
                  density === id
                    ? 'bg-[#ff2d5f] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Reset View Option Button */}
        <button
          type="button"
          onClick={onResetClick || onResetAll || onResetFilters}
          title="Reset and clear all tasks in currently active table snapshot"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-rose-50 dark:bg-[#020612] dark:hover:bg-[#ff2d5f]/15 hover:text-[#ff2d5f] dark:hover:text-[#ff2d5f] rounded-lg border border-slate-200 dark:border-[#142552] hover:border-rose-300 dark:hover:border-[#ff2d5f]/40 transition-colors cursor-pointer group"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#ff2d5f] transition-transform group-hover:-rotate-45" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
