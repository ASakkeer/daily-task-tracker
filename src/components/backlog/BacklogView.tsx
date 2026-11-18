import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Zap,
  Edit2,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Milestone,
  Flag,
  Calendar,
  CalendarDays,
  Clock,
  ArrowUpDown,
  User,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  AppMetadata,
  BacklogItem,
  BacklogPriority,
  BacklogStatus,
  BacklogType,
} from '../../types';
import {
  db,
  logActivity,
  exportBacklogToJson,
  importBacklogFromJson,
} from '../../db';
import { BACKLOG_STATUSES, BACKLOG_TYPES, getPriorityBadge } from './backlogConstants';
import { CustomDropdown } from '../common/CustomDropdown';
import { BacklogItemModal } from '../modals/BacklogItemModal';
import { BacklogPushToTaskModal } from '../modals/BacklogPushToTaskModal';
import { ConfirmationModal, ConfirmationVariant } from '../common/ConfirmationModal';
import { getTodayDateStr, formatDateSafe } from '../../utils/date';
import { cn } from '../../utils/cn';

interface BacklogViewProps {
  metadata: AppMetadata;
  onMetadataUpdated: () => void;
}

type BacklogTab = 'active' | 'completed';

export const BacklogView: React.FC<BacklogViewProps> = ({ metadata, onMetadataUpdated }) => {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<BacklogTab>('active');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');

  // Selected for batch operations
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);
  const [pushingItem, setPushingItem] = useState<BacklogItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  // Confirmation modal
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: ConfirmationVariant;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentActor = metadata.owners?.[0]?.name || 'Admin';
  const currentActorRole = metadata.owners?.[0]?.role || 'Team Lead';
  const todayStr = getTodayDateStr();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadItems = async () => {
    try {
      const allItems = await db.backlogItems.toArray();
      setItems(allItems);
    } catch (err) {
      console.error('Failed to load backlog items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  // Split into active and completed datasets
  const activeItems = useMemo(() => items.filter((i) => i.status !== 'completed'), [items]);
  const completedItems = useMemo(() => items.filter((i) => i.status === 'completed'), [items]);

  // Priority count & due today count for metrics
  const dueTodayCount = useMemo(() => {
    return activeItems.filter((i) => i.targetDate === todayStr).length;
  }, [activeItems, todayStr]);

  const overdueCount = useMemo(() => {
    return activeItems.filter((i) => i.targetDate && i.targetDate < todayStr).length;
  }, [activeItems, todayStr]);

  const criticalP0P1Count = useMemo(() => {
    return activeItems.filter((i) => {
      const p = (i.priority || '').toUpperCase();
      return p.includes('P0') || p.includes('P1');
    }).length;
  }, [activeItems]);

  // Filter and sort items based on activeTab
  const displayedItems = useMemo(() => {
    const sourceList = activeTab === 'active' ? activeItems : completedItems;

    return sourceList
      .filter((item) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchNotes = item.notes?.toLowerCase().includes(q);
          const matchEpic = item.moduleEpic?.toLowerCase().includes(q);
          const matchCustomOwner = item.customOwnerText?.toLowerCase().includes(q);
          const matchOwners = (item.ownerIds || []).some((id) => {
            const owner = metadata.owners.find((o) => o.id === id);
            return owner?.name.toLowerCase().includes(q);
          });
          if (!matchTitle && !matchNotes && !matchEpic && !matchCustomOwner && !matchOwners) {
            return false;
          }
        }

        // Type filter
        if (typeFilter !== 'ALL' && item.type !== typeFilter) {
          return false;
        }

        // Priority filter
        if (priorityFilter !== 'ALL') {
          const p = (item.priority || '').toUpperCase();
          if (!p.includes(priorityFilter)) return false;
        }

        // Owner filter
        if (ownerFilter !== 'ALL') {
          if (!(item.ownerIds || []).includes(ownerFilter)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (activeTab === 'completed') {
          // Completed tab: Sort by completedDate descending (newest completed first)
          const dateA = a.completedDate || a.updatedAt || a.createdAt;
          const dateB = b.completedDate || b.updatedAt || b.createdAt;
          return dateB.localeCompare(dateA);
        }

        // Active Backlog: Order properly based on dates!
        // 1. Overdue (< today) & Today (= today) come first
        const hasDateA = !!a.targetDate;
        const hasDateB = !!b.targetDate;

        if (!hasDateA && !hasDateB) return (a.order || 0) - (b.order || 0);
        if (!hasDateA) return 1; // items without date go to the bottom
        if (!hasDateB) return -1;

        const isTodayA = a.targetDate === todayStr;
        const isTodayB = b.targetDate === todayStr;
        const isOverdueA = (a.targetDate || '') < todayStr;
        const isOverdueB = (b.targetDate || '') < todayStr;

        // Today items at top
        if (isTodayA && !isTodayB && !isOverdueB) return -1;
        if (isTodayB && !isTodayA && !isOverdueA) return 1;

        // Overdue items
        if (isOverdueA && !isOverdueB && !isTodayB) return -1;
        if (isOverdueB && !isOverdueA && !isTodayA) return 1;

        // Both future or both past: sort chronologically ascending
        return (a.targetDate || '').localeCompare(b.targetDate || '');
      });
  }, [activeTab, activeItems, completedItems, searchQuery, typeFilter, priorityFilter, ownerFilter, todayStr, metadata.owners]);

  // Save / Update Item
  const handleSaveItem = async (itemData: Omit<BacklogItem, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();

    if (editingItem) {
      const updated: BacklogItem = {
        ...editingItem,
        ...itemData,
        updatedAt: now,
      };
      await db.backlogItems.put(updated);
      await logActivity({
        actionType: 'task_update',
        actionLabel: 'Updated Backlog Item',
        entityType: 'backlog',
        entityId: updated.id,
        entityTitle: updated.title,
        actor: currentActor,
        actorRole: currentActorRole,
        details: `Updated details for work item "${updated.title}".`,
        severity: 'info',
      });
      showToast(`Work item "${updated.title}" updated.`);
    } else {
      const newOrder = items.length > 0 ? Math.max(...items.map((i) => i.order || 0)) + 1 : 1;
      const newItem: BacklogItem = {
        id: `backlog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        order: newOrder,
        ...itemData,
        createdAt: now,
        updatedAt: now,
      };
      await db.backlogItems.put(newItem);
      await logActivity({
        actionType: 'task_create',
        actionLabel: 'Created Backlog Item',
        entityType: 'backlog',
        entityId: newItem.id,
        entityTitle: newItem.title,
        actor: currentActor,
        actorRole: currentActorRole,
        details: `Created new ${newItem.type} backlog item "${newItem.title}" with priority ${newItem.priority}.`,
        severity: 'info',
      });
      showToast(`Work item "${newItem.title}" created.`);
    }
    loadItems();
    setEditingItem(null);
  };

  // Quick Status Change
  const handleQuickStatusChange = async (itemId: string, newStatus: BacklogStatus) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const updates: Partial<BacklogItem> = {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    if (newStatus === 'completed' && !item.completedDate) {
      updates.completedDate = todayStr;
    } else if (newStatus !== 'completed' && item.completedDate) {
      updates.completedDate = undefined;
    }

    await db.backlogItems.update(itemId, updates);

    await logActivity({
      actionType: 'status_change',
      actionLabel: 'Backlog Status Changed',
      entityType: 'backlog',
      entityId: itemId,
      entityTitle: item.title,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Status of "${item.title}" changed from ${BACKLOG_STATUSES[item.status]?.label || item.status} to ${BACKLOG_STATUSES[newStatus]?.label || newStatus}`,
      severity: 'info',
    });

    showToast(`Status changed to ${BACKLOG_STATUSES[newStatus]?.label || newStatus}`);
    loadItems();
  };

  // Delete Single Item with Confirmation
  const handleDeleteItem = (item: BacklogItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Backlog Item?',
      description: `Are you sure you want to delete "${item.title}"? This item will be permanently removed from the backlog.`,
      confirmLabel: 'Delete Item',
      variant: 'danger',
      onConfirm: async () => {
        await db.backlogItems.delete(item.id);
        await logActivity({
          actionType: 'task_delete',
          actionLabel: 'Deleted Backlog Item',
          entityType: 'backlog',
          entityId: item.id,
          entityTitle: item.title,
          actor: currentActor,
          actorRole: currentActorRole,
          details: `Deleted work item "${item.title}" from the backlog.`,
          severity: 'danger',
        });
        showToast(`Work item "${item.title}" deleted.`);
        loadItems();
        setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
      },
    });
  };

  // Batch Delete with Confirmation
  const handleBatchDelete = () => {
    if (selectedItemIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${selectedItemIds.length} Selected Items?`,
      description: `Are you sure you want to permanently delete the ${selectedItemIds.length} selected backlog work items? This cannot be undone.`,
      confirmLabel: 'Delete Selected',
      variant: 'danger',
      onConfirm: async () => {
        await db.backlogItems.bulkDelete(selectedItemIds);
        await logActivity({
          actionType: 'batch_delete',
          actionLabel: 'Batch Deleted Backlog Items',
          entityType: 'backlog',
          entityId: 'batch_delete',
          entityTitle: `${selectedItemIds.length} Work Items`,
          actor: currentActor,
          actorRole: currentActorRole,
          details: `Batch deleted ${selectedItemIds.length} items from backlog.`,
          severity: 'danger',
        });
        showToast(`Deleted ${selectedItemIds.length} items.`);
        setSelectedItemIds([]);
        loadItems();
      },
    });
  };

  // Select all visible
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedItemIds(displayedItems.map((i) => i.id));
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-4 max-w-[1300px] mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 dark:bg-[#08122f] text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 dark:border-[#ff2d5f]/40 backdrop-blur-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#ff2d5f]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER & ACTION BAR */}
      <div className="bg-white dark:bg-[#050c21] p-4 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff2d5f] to-rose-600 text-white flex items-center justify-center shadow-md shadow-[#ff2d5f]/25 font-black text-sm">
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Work Item Backlog
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-[#ff2d5f]/20 text-[#ff2d5f]">
              Target Date Driven
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Simplified work item tracker organized by target dates with instant daily task push.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedItemIds.length > 0 && (
            <button
              type="button"
              onClick={handleBatchDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-bold transition-all hover:bg-rose-100 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedItemIds.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-xl text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/25 hover:scale-102 active:scale-98 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Work Item</span>
          </button>
        </div>
      </div>

      {/* TOP COMPACT METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#050c21] p-3 rounded-xl border border-slate-200 dark:border-[#142552] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Backlog</span>
            <Layers className="w-3.5 h-3.5 text-[#ff2d5f]" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
            {activeItems.length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">In-flight work items</span>
        </div>

        <div className="bg-white dark:bg-[#050c21] p-3 rounded-xl border border-slate-200 dark:border-[#142552] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Due Today</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
            {dueTodayCount}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {overdueCount > 0 ? `${overdueCount} overdue` : 'On track for today'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#050c21] p-3 rounded-xl border border-slate-200 dark:border-[#142552] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">High Priority</span>
            <Flag className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-black text-[#ff2d5f] font-mono mt-1">
            {criticalP0P1Count}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">P0 Critical &amp; P1 High</span>
        </div>

        <div className="bg-white dark:bg-[#050c21] p-3 rounded-xl border border-slate-200 dark:border-[#142552] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {completedItems.length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Archived as completed</span>
        </div>
      </div>

      {/* TWO TABS: ACTIVE BACKLOG & COMPLETED */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-[#142552] pb-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer',
              activeTab === 'active'
                ? 'bg-[#ff2d5f] text-white shadow-md shadow-[#ff2d5f]/25 scale-102'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#08122f]'
            )}
          >
            <span>Active Backlog</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold',
                activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-[#142552] text-slate-700 dark:text-slate-300'
              )}
            >
              {activeItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer',
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 scale-102'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#08122f]'
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed Archive</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold',
                activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-[#142552] text-slate-700 dark:text-slate-300'
              )}
            >
              {completedItems.length}
            </span>
          </button>
        </div>

        {/* Informational sorting note */}
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium hidden md:inline">
          {activeTab === 'active' ? '⚡ Sorted: Today on top → Future target dates below' : '✅ Sorted: Most recently completed first'}
        </span>
      </div>

      {/* MINIMAL FILTER TOOLBAR */}
      <div className="bg-white dark:bg-[#050c21] p-3 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search work items, epics, notes..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-lg text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#ff2d5f]"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority filter */}
          <div className="w-[125px]">
            <CustomDropdown
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: 'ALL', label: 'All Priorities' },
                { value: 'P0', label: 'P0 Critical' },
                { value: 'P1', label: 'P1 High' },
                { value: 'P2', label: 'P2 Medium' },
                { value: 'P3', label: 'P3 Low' },
              ]}
              className="w-full"
              buttonClassName="py-1 px-2.5 text-xs font-bold"
            />
          </div>

          {/* Type filter */}
          <div className="w-[125px]">
            <CustomDropdown
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'ALL', label: 'All Types' },
                ...Object.values(BACKLOG_TYPES).map((t) => ({
                  value: t.value,
                  label: t.label,
                })),
              ]}
              className="w-full"
              buttonClassName="py-1 px-2.5 text-xs font-bold"
            />
          </div>

          {/* Owner filter */}
          {metadata.owners && metadata.owners.length > 0 && (
            <div className="w-[140px]">
              <CustomDropdown
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={[
                  { value: 'ALL', label: 'All Assignees' },
                  ...metadata.owners.map((o) => ({
                    value: o.id,
                    label: o.name,
                    avatarColor: o.avatarColor,
                  })),
                ]}
                className="w-full"
                buttonClassName="py-1 px-2.5 text-xs font-bold"
              />
            </div>
          )}

          {(searchQuery || typeFilter !== 'ALL' || priorityFilter !== 'ALL' || ownerFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('ALL');
                setPriorityFilter('ALL');
                setOwnerFilter('ALL');
              }}
              className="px-2 py-1 text-slate-500 hover:text-[#ff2d5f] text-xs font-bold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* MINIMAL BACKLOG TABLE */}
      <div className="bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#020612] border-b border-slate-200 dark:border-[#142552] text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider select-none">
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={displayedItems.length > 0 && selectedItemIds.length === displayedItems.length}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 text-[#ff2d5f] rounded border-slate-300 focus:ring-[#ff2d5f]"
                  />
                </th>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-16 text-center">Priority</th>
                <th className="py-2.5 px-4 min-w-[260px]">Work Item Summary / Task Details</th>
                <th className="py-2.5 px-3 w-32">Status</th>
                <th className="py-2.5 px-3 w-36">Assignee</th>
                <th className="py-2.5 px-3 w-28">Created Date</th>
                <th className="py-2.5 px-3 w-32">
                  <div className="flex items-center gap-1 text-[#ff2d5f]">
                    <span>Target Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                {activeTab === 'completed' && <th className="py-2.5 px-3 w-32">Completed Date</th>}
                <th className="py-2.5 px-3 w-28 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-[#142552]/40">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'completed' ? 10 : 9} className="py-12 text-center text-slate-400 text-xs">
                    {activeTab === 'active'
                      ? 'No active work items found. Click "+ New Work Item" to plan a task.'
                      : 'No completed work items in the archive yet.'}
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, index) => {
                  const pBadge = getPriorityBadge(item.priority, metadata.backlogConfig?.priorities);
                  const isSelected = selectedItemIds.includes(item.id);
                  const isToday = item.targetDate === todayStr;
                  const isOverdue = item.targetDate && item.targetDate < todayStr && item.status !== 'completed';

                  // Assignee resolution
                  const ownerNames = item.customOwnerText
                    ? item.customOwnerText
                    : (item.ownerIds || [])
                        .map((id) => metadata.owners.find((o) => o.id === id)?.name)
                        .filter(Boolean)
                        .join(', ') || 'Unassigned';

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'transition-colors hover:bg-slate-50/80 dark:hover:bg-[#08122f]/60',
                        isSelected ? 'bg-rose-50/50 dark:bg-[#ff2d5f]/10' : '',
                        isToday && activeTab === 'active' ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="w-3.5 h-3.5 text-[#ff2d5f] rounded border-slate-300 focus:ring-[#ff2d5f]"
                        />
                      </td>

                      {/* Rank / Index */}
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                        #{index + 1}
                      </td>

                      {/* Minimal Priority: P0, P1, P2, P3 */}
                      <td className="py-2 px-3 text-center">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[11px] font-black font-mono border"
                          style={{
                            backgroundColor: pBadge.bgColor,
                            color: pBadge.color,
                            borderColor: pBadge.badgeBorder,
                          }}
                        >
                          {pBadge.label}
                        </span>
                      </td>

                      {/* Work Item Summary */}
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              'font-bold text-slate-900 dark:text-white',
                              item.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : ''
                            )}
                          >
                            {item.title}
                          </span>

                          {/* Type Pill */}
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-[#08122f] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#142552]">
                            {item.type}
                          </span>

                          {/* Optional Module Epic */}
                          {item.moduleEpic && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                              {item.moduleEpic}
                            </span>
                          )}

                          {item.storyPoints !== undefined && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {item.storyPoints} pts
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-lg mt-0.5">
                            {item.notes}
                          </p>
                        )}
                      </td>

                      {/* Status Dropdown Pill (Unconstrained Floating Portal) */}
                      <td className="py-2 px-3">
                        <div className="w-[120px]">
                          <CustomDropdown
                            value={item.status}
                            onChange={(newStatus) => handleQuickStatusChange(item.id, newStatus as BacklogStatus)}
                            options={Object.values(BACKLOG_STATUSES).map((st) => ({
                              value: st.value,
                              label: st.label,
                              className: cn(st.badgeBg, st.badgeText, st.badgeBorder),
                            }))}
                            pillMode
                            className="w-full"
                            buttonClassName="px-2 py-0.5 text-[11px] font-bold rounded-lg border shadow-none"
                          />
                        </div>
                      </td>

                      {/* Assignee */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold truncate">
                          <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{ownerNames}</span>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDateSafe(item.createdAt, 'dd-MMM-yyyy')}
                      </td>

                      {/* Target Date */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {item.targetDate ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'font-mono text-[11px] font-bold',
                                isToday ? 'text-amber-600 dark:text-amber-400 font-black' : '',
                                isOverdue ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-700 dark:text-slate-300'
                              )}
                            >
                              {formatDateSafe(item.targetDate, 'dd-MMM-yyyy')}
                            </span>
                            {isToday && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                Today
                              </span>
                            )}
                            {isOverdue && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                                Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Completed Date (Only in Completed Tab) */}
                      {activeTab === 'completed' && (
                        <td className="py-2 px-3 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                          {item.completedDate ? formatDateSafe(item.completedDate, 'dd-MMM-yyyy') : formatDateSafe(item.updatedAt, 'dd-MMM-yyyy')}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* Push to Daily Tasks Button */}
                          <button
                            type="button"
                            onClick={() => setPushingItem(item)}
                            className="p-1.5 text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Push item directly into today's daily report table"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-[#ff2d5f] hover:bg-rose-50 dark:hover:bg-[#ff2d5f]/15 rounded-lg transition-colors cursor-pointer"
                            title="Edit work item details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete work item permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT BACKLOG ITEM MODAL */}
      <BacklogItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        initialItem={editingItem}
        metadata={metadata}
      />

      {/* PUSH TO DAILY TASK MODAL */}
      <BacklogPushToTaskModal
        isOpen={!!pushingItem}
        onClose={() => setPushingItem(null)}
        item={pushingItem}
        metadata={metadata}
        onSuccess={(msg) => {
          showToast(msg);
          loadItems();
        }}
      />

      {/* CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
};
