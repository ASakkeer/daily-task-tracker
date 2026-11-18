import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
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
  Tag,
  ChevronDown,
  X,
  FileJson,
  GripVertical,
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
import { BACKLOG_PRIORITIES, BACKLOG_STATUSES, BACKLOG_TYPES } from './backlogConstants';
import { BacklogItemModal } from '../modals/BacklogItemModal';
import { BacklogPushToTaskModal } from '../modals/BacklogPushToTaskModal';
import { ConfirmationModal, ConfirmationVariant } from '../common/ConfirmationModal';
import { cn } from '../../utils/cn';

interface BacklogViewProps {
  metadata: AppMetadata;
  onMetadataUpdated: () => void;
}

type SortField = 'order' | 'priority' | 'points' | 'title' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export const BacklogView: React.FC<BacklogViewProps> = ({ metadata, onMetadataUpdated }) => {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sprintFilter, setSprintFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('order');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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
    isAlertOnly?: boolean;
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadItems = async () => {
    try {
      const allItems = await db.backlogItems.orderBy('order').toArray();
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

  // Filtered & Sorted Items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search
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
        if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) {
          return false;
        }

        // Status filter
        if (statusFilter !== 'ALL' && item.status !== statusFilter) {
          return false;
        }

        // Sprint filter
        if (sprintFilter !== 'ALL' && item.targetSprint !== sprintFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'order') {
          cmp = (a.order || 0) - (b.order || 0);
        } else if (sortField === 'priority') {
          const priorityWeight: Record<BacklogPriority, number> = {
            P0_CRITICAL: 0,
            P1_HIGH: 1,
            P2_MEDIUM: 2,
            P3_LOW: 3,
          };
          cmp = priorityWeight[a.priority] - priorityWeight[b.priority];
        } else if (sortField === 'points') {
          cmp = (a.storyPoints || 0) - (b.storyPoints || 0);
        } else if (sortField === 'title') {
          cmp = a.title.localeCompare(b.title);
        } else if (sortField === 'createdAt') {
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
  }, [items, searchQuery, typeFilter, priorityFilter, statusFilter, sprintFilter, sortField, sortDirection, metadata.owners]);

  // Metrics
  const metrics = useMemo(() => {
    const totalItems = items.length;
    const totalPoints = items.reduce((acc, i) => acc + (i.storyPoints || 0), 0);
    const criticalHighCount = items.filter(
      (i) => i.priority === 'P0_CRITICAL' || i.priority === 'P1_HIGH'
    ).length;
    const readyForDevCount = items.filter((i) => i.status === 'ready_for_dev').length;
    const inProgressCount = items.filter((i) => i.status === 'in_progress').length;

    return { totalItems, totalPoints, criticalHighCount, readyForDevCount, inProgressCount };
  }, [items]);

  // Handle Save (Create or Update)
  const handleSaveItem = async (
    itemData: Omit<BacklogItem, 'id' | 'order' | 'createdAt' | 'updatedAt'>
  ) => {
    const now = new Date().toISOString();
    if (editingItem) {
      const updated: BacklogItem = {
        ...editingItem,
        ...itemData,
        updatedAt: now,
      };
      await db.backlogItems.put(updated);
      await logActivity({
        actionType: 'backlog_update',
        actionLabel: 'Updated Backlog Item',
        entityType: 'backlog',
        entityId: updated.id,
        entityTitle: updated.title,
        actor: currentActor,
        actorRole: currentActorRole,
        details: `Updated details for backlog work item "${updated.title}".`,
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
        actionType: 'backlog_create',
        actionLabel: 'Created Backlog Item',
        entityType: 'backlog',
        entityId: newItem.id,
        entityTitle: newItem.title,
        actor: currentActor,
        actorRole: currentActorRole,
        details: `Created new ${newItem.type} backlog item "${newItem.title}" with priority ${newItem.priority}.`,
        severity: 'success',
      });
      showToast(`Work item "${newItem.title}" created.`);
    }
    loadItems();
    setEditingItem(null);
  };

  // Handle Quick Status Change
  const handleQuickStatusChange = async (itemId: string, newStatus: BacklogStatus) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    await db.backlogItems.update(itemId, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    await logActivity({
      actionType: 'backlog_update',
      actionLabel: 'Backlog Status Changed',
      entityType: 'backlog',
      entityId: itemId,
      entityTitle: item.title,
      actor: currentActor,
      actorRole: currentActorRole,
      details: `Status changed from ${BACKLOG_STATUSES[item.status]?.label} to ${BACKLOG_STATUSES[newStatus]?.label}`,
      severity: 'info',
    });

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: newStatus, updatedAt: new Date().toISOString() } : i))
    );
  };

  // Handle Quick Priority Change
  const handleQuickPriorityChange = async (itemId: string, newPriority: BacklogPriority) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    await db.backlogItems.update(itemId, {
      priority: newPriority,
      updatedAt: new Date().toISOString(),
    });

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, priority: newPriority, updatedAt: new Date().toISOString() } : i))
    );
  };

  // Handle Delete
  const handleDeleteItem = (item: BacklogItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Backlog Item',
      description: `Are you sure you want to delete "${item.title}"? This action will permanently remove the item from the backlog.`,
      confirmLabel: 'Delete Item',
      variant: 'danger',
      onConfirm: async () => {
        await db.backlogItems.delete(item.id);
        await logActivity({
          actionType: 'backlog_delete',
          actionLabel: 'Deleted Backlog Item',
          entityType: 'backlog',
          entityId: item.id,
          entityTitle: item.title,
          actor: currentActor,
          actorRole: currentActorRole,
          details: `Deleted work item "${item.title}" from the product backlog.`,
          severity: 'danger',
        });
        showToast(`Work item "${item.title}" deleted.`);
        loadItems();
      },
    });
  };

  // Handle Batch Delete
  const handleBatchDelete = () => {
    if (selectedItemIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${selectedItemIds.length} Work Items`,
      description: `Are you sure you want to permanently delete the ${selectedItemIds.length} selected backlog work items?`,
      confirmLabel: 'Delete Selected',
      variant: 'danger',
      onConfirm: async () => {
        await db.backlogItems.bulkDelete(selectedItemIds);
        await logActivity({
          actionType: 'backlog_delete',
          actionLabel: 'Batch Deleted Backlog Items',
          entityType: 'backlog',
          entityId: 'batch_delete',
          entityTitle: `${selectedItemIds.length} Work Items`,
          actor: currentActor,
          actorRole: currentActorRole,
          details: `Batch deleted ${selectedItemIds.length} work items from the backlog.`,
          severity: 'danger',
        });
        showToast(`${selectedItemIds.length} work items deleted.`);
        setSelectedItemIds([]);
        loadItems();
      },
    });
  };

  // Handle Export Backlog JSON
  const handleExportJson = async () => {
    try {
      const jsonStr = await exportBacklogToJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Daily-Task-Tracker-Backlog-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Backlog JSON downloaded successfully.');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`);
    }
  };

  // Handle Import Backlog JSON
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importBacklogFromJson(text);
      if (result.success) {
        showToast(result.summary || 'Backlog restored successfully.');
        loadItems();
      } else {
        setConfirmDialog({
          isOpen: true,
          title: 'Invalid Backlog File',
          description: result.error || 'Failed to parse JSON file.',
          confirmLabel: 'Dismiss',
          isAlertOnly: true,
          variant: 'danger',
          onConfirm: () => {},
        });
      }
    } catch (err: any) {
      showToast(`Restore failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Move priority order up / down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredItems.length) return;

    const currentItem = filteredItems[index];
    const targetItem = filteredItems[targetIndex];

    const currentOrder = currentItem.order;
    const targetOrder = targetItem.order;

    await db.backlogItems.update(currentItem.id, { order: targetOrder });
    await db.backlogItems.update(targetItem.id, { order: currentOrder });

    loadItems();
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    typeFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    sprintFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setPriorityFilter('ALL');
    setStatusFilter('ALL');
    setSprintFilter('ALL');
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        isAlertOnly={confirmDialog.isAlertOnly}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Add / Edit Backlog Modal */}
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

      {/* Push to Tasks Modal */}
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

      {/* Hidden File Input for JSON Restore */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleImportJson}
        className="hidden"
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#050c21] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Work Items</span>
            <Layers className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{metrics.totalItems}</div>
          <span className="text-[10px] text-slate-400 font-medium">Sprint &amp; Product scope</span>
        </div>

        <div className="bg-white dark:bg-[#050c21] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Story Points</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{metrics.totalPoints} pts</div>
          <span className="text-[10px] text-slate-400 font-medium">Estimated team effort</span>
        </div>

        <div className="bg-white dark:bg-[#050c21] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">P0 / P1 Urgent</span>
            <Flag className="w-3.5 h-3.5 text-[#ff2d5f]" />
          </div>
          <div className="text-xl font-black text-[#ff2d5f]">{metrics.criticalHighCount}</div>
          <span className="text-[10px] text-slate-400 font-medium">Requires immediate dev</span>
        </div>

        <div className="bg-white dark:bg-[#050c21] p-3.5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ready for Dev</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{metrics.readyForDevCount}</div>
          <span className="text-[10px] text-slate-400 font-medium">Refined &amp; prioritized</span>
        </div>
      </div>

      {/* Sticky Command Bar & Filter Toolbar */}
      <div className="bg-white dark:bg-[#050c21] p-3.5 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm space-y-3">
        {/* Top Actions Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search work items, epics, notes, assignees..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-900 dark:text-white placeholder-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#08122f] rounded-xl border border-slate-200 dark:border-[#142552] transition-colors cursor-pointer flex items-center gap-1.5"
              title="Download Backlog as JSON"
            >
              <FileJson className="w-3.5 h-3.5 text-cyan-500" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#08122f] rounded-xl border border-slate-200 dark:border-[#142552] transition-colors cursor-pointer flex items-center gap-1.5"
              title="Upload & Restore Backlog from JSON"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-500" />
              <span>Restore</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-black text-white bg-[#ff2d5f] hover:bg-[#e02653] shadow-md shadow-[#ff2d5f]/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ml-auto sm:ml-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Backlog Item</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#142552]/60 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#ff2d5f]" />
            Filters:
          </span>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-lg font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#ff2d5f]"
          >
            <option value="ALL">All Types</option>
            {Object.values(BACKLOG_TYPES).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-lg font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#ff2d5f]"
          >
            <option value="ALL">All Priorities</option>
            {Object.values(BACKLOG_PRIORITIES).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-lg font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#ff2d5f]"
          >
            <option value="ALL">All Statuses</option>
            {Object.values(BACKLOG_STATUSES).map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Sprint Filter */}
          {metadata.backlogConfig?.sprints && metadata.backlogConfig.sprints.length > 0 && (
            <select
              value={sprintFilter}
              onChange={(e) => setSprintFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-lg font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#ff2d5f]"
            >
              <option value="ALL">All Sprints</option>
              {metadata.backlogConfig.sprints.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          )}

          {/* Sort Field */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[11px] font-bold text-slate-400">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-2 py-1 bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-lg font-semibold text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
            >
              <option value="order">Manual Priority Order</option>
              <option value="priority">Priority Level</option>
              <option value="points">Story Points</option>
              <option value="title">Item Title</option>
              <option value="createdAt">Date Created</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded border border-slate-200 dark:border-[#142552]"
              title={`Sorting ${sortDirection.toUpperCase()}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] font-bold text-[#ff2d5f] hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Batch Operations Bar */}
      {selectedItemIds.length > 0 && (
        <div className="bg-slate-900 dark:bg-[#08122f] text-white p-3 rounded-xl border border-slate-800 dark:border-[#ff2d5f]/30 flex items-center justify-between animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="px-2 py-0.5 bg-[#ff2d5f] text-white rounded text-[11px]">
              {selectedItemIds.length} Selected
            </span>
            <span>Batch actions ready</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedItemIds([])}
              className="px-3 py-1 text-xs font-semibold hover:bg-white/10 rounded-lg transition-colors"
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={handleBatchDelete}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive Backlog Table */}
      <div className="bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl overflow-hidden transition-colors">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-[#ff2d5f]/10 border border-rose-200 dark:border-[#ff2d5f]/20 flex items-center justify-center text-[#ff2d5f]">
              <Layers className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {items.length === 0 ? 'No Backlog Items Yet' : 'No Items Match Current Filters'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {items.length === 0
                  ? 'Your product and sprint backlog is completely clean. Create user stories, defects, technical tasks, or research spikes.'
                  : 'Try clearing your search query or loosening your type and priority filters.'}
              </p>
            </div>
            {items.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsModalOpen(true);
                }}
                className="px-5 py-2 text-xs font-black text-white bg-[#ff2d5f] hover:bg-[#e02653] shadow-md shadow-[#ff2d5f]/20 rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create First Work Item</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-1.5 text-xs font-bold text-[#ff2d5f] border border-[#ff2d5f]/30 hover:bg-[#ff2d5f]/10 rounded-xl transition-colors cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-[#020612]/80 border-b border-slate-200 dark:border-[#142552] text-slate-600 dark:text-slate-300 font-extrabold text-[11px] uppercase tracking-wider select-none">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredItems.length > 0 &&
                        filteredItems.every((i) => selectedItemIds.includes(i.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItemIds(filteredItems.map((i) => i.id));
                        } else {
                          setSelectedItemIds([]);
                        }
                      }}
                      className="rounded text-[#ff2d5f] focus:ring-[#ff2d5f] w-3.5 h-3.5"
                    />
                  </th>
                  <th className="py-3 px-2 w-16 text-center">Rank</th>
                  <th className="py-3 px-3 w-28">Priority</th>
                  <th className="py-3 px-3 w-28">Type</th>
                  <th className="py-3 px-4 min-w-[280px]">Work Item Summary</th>
                  <th className="py-3 px-3 w-32">Status</th>
                  <th className="py-3 px-3 w-20 text-center">Points</th>
                  <th className="py-3 px-3 w-32">Assignee</th>
                  <th className="py-3 px-3 w-28">Module / Epic</th>
                  <th className="py-3 px-3 w-28">Target Sprint</th>
                  <th className="py-3 px-3 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#142552]/40">
                {filteredItems.map((item, index) => {
                  const isSelected = selectedItemIds.includes(item.id);
                  const pConfig = BACKLOG_PRIORITIES[item.priority] || BACKLOG_PRIORITIES.P2_MEDIUM;
                  const tConfig = BACKLOG_TYPES[item.type] || BACKLOG_TYPES.feature;
                  const sConfig = BACKLOG_STATUSES[item.status] || BACKLOG_STATUSES.backlog;

                  const ownerNames = (item.ownerIds || [])
                    .map((id) => metadata.owners.find((o) => o.id === id)?.name)
                    .filter(Boolean);

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'hover:bg-slate-50/70 dark:hover:bg-[#08122f]/60 transition-colors group',
                        isSelected && 'bg-rose-50/40 dark:bg-[#ff2d5f]/10'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedItemIds((prev) =>
                              e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                            );
                          }}
                          className="rounded text-[#ff2d5f] focus:ring-[#ff2d5f] w-3.5 h-3.5"
                        />
                      </td>

                      {/* Rank / Order controls */}
                      <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveOrder(index, 'up')}
                            className="p-0.5 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <span className="font-bold w-4 text-center">{index + 1}</span>
                          <button
                            type="button"
                            disabled={index === filteredItems.length - 1}
                            onClick={() => handleMoveOrder(index, 'down')}
                            className="p-0.5 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            ▼
                          </button>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-3">
                        <select
                          value={item.priority}
                          onChange={(e) => handleQuickPriorityChange(item.id, e.target.value as BacklogPriority)}
                          className={cn(
                            'text-[11px] font-black px-2 py-0.5 rounded-md border appearance-none cursor-pointer focus:outline-none transition-all',
                            pConfig.badgeBg,
                            pConfig.badgeText,
                            pConfig.badgeBorder
                          )}
                        >
                          {Object.values(BACKLOG_PRIORITIES).map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Type */}
                      <td className="py-2.5 px-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border',
                            tConfig.badgeBg,
                            tConfig.badgeText,
                            tConfig.badgeBorder
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full', tConfig.dotColor)} />
                          {tConfig.label}
                        </span>
                      </td>

                      {/* Title & Notes */}
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                          {item.title}
                        </div>
                        {item.notes && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 font-normal">
                            {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <select
                          value={item.status}
                          onChange={(e) => handleQuickStatusChange(item.id, e.target.value as BacklogStatus)}
                          className={cn(
                            'text-[11px] font-bold px-2 py-0.5 rounded-md border appearance-none cursor-pointer focus:outline-none transition-all',
                            sConfig.badgeBg,
                            sConfig.badgeText,
                            sConfig.badgeBorder
                          )}
                        >
                          {Object.values(BACKLOG_STATUSES).map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Points */}
                      <td className="py-2.5 px-3 text-center">
                        {item.storyPoints !== undefined ? (
                          <span className="font-mono font-black text-xs px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-[#142552]">
                            {item.storyPoints}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="py-2.5 px-3">
                        {ownerNames.length > 0 || item.customOwnerText ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ownerNames.map((name) => (
                              <span
                                key={name}
                                className="px-2 py-0.5 bg-slate-100 dark:bg-[#08122f] rounded text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#142552]"
                              >
                                {name}
                              </span>
                            ))}
                            {item.customOwnerText && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                {item.customOwnerText}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Module / Epic */}
                      <td className="py-2.5 px-3">
                        {item.moduleEpic ? (
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded text-[11px] font-bold border border-blue-200 dark:border-blue-500/20">
                            {item.moduleEpic}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Target Sprint */}
                      <td className="py-2.5 px-3">
                        {item.targetSprint ? (
                          <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded text-[11px] font-bold border border-indigo-200 dark:border-indigo-500/20">
                            {item.targetSprint}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPushingItem(item)}
                            className="px-2 py-1 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/25 rounded-lg border border-amber-200 dark:border-amber-500/30 text-[11px] font-black transition-colors cursor-pointer flex items-center gap-1"
                            title="Push into Daily Standup Task Table"
                          >
                            <Zap className="w-3 h-3 fill-amber-500" />
                            <span className="hidden sm:inline">Push</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#08122f] transition-colors cursor-pointer"
                            title="Edit Work Item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Work Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
