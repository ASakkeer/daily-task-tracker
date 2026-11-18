import React, { useState } from 'react';
import { OwnerItem } from '../../types';
import { Plus, Trash2, Users, Sparkles } from 'lucide-react';
import { ColorPickerPopover } from '../common/ColorPickerPopover';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface OwnerManagerProps {
  owners: OwnerItem[];
  onChange: (owners: OwnerItem[]) => void;
}

const AVATAR_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F97316', // Orange
];

export const OwnerManager: React.FC<OwnerManagerProps> = ({ owners, onChange }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [avatarColor, setAvatarColor] = useState('#3B82F6');

  // Multi-owner preset generator state
  const [selectedForPreset, setSelectedForPreset] = useState<string[]>([]);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'cyan';
    isAlertOnly?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'danger',
    isAlertOnly: false,
    onConfirm: () => {},
  });

  const handleAddOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newOwner: OwnerItem = {
      id: `owner_${Date.now()}`,
      name: name.trim(),
      role: role.trim() || undefined,
      avatarColor,
    };

    onChange([...owners, newOwner]);
    setName('');
    setRole('');
    setAvatarColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  };

  const handleDelete = (id: string) => {
    if (owners.length <= 1) {
      setConfirmModal({
        isOpen: true,
        title: 'Team Requirement',
        message: 'You must have at least one team member registered.',
        confirmText: 'Understood',
        variant: 'warning',
        isAlertOnly: true,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const o = owners.find((item) => item.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Remove Team Member',
      message: `Are you sure you want to remove "${o?.name}"? Existing tasks will retain their history.`,
      confirmText: 'Remove',
      variant: 'danger',
      isAlertOnly: false,
      onConfirm: () => {
        onChange(owners.filter((item) => item.id !== id));
        setSelectedForPreset((prev) => prev.filter((pId) => pId !== id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleUpdate = (id: string, updates: Partial<OwnerItem>) => {
    onChange(owners.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  };

  const handleToggleSelectForPreset = (id: string) => {
    setSelectedForPreset((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateMultiOwnerPreset = () => {
    if (selectedForPreset.length < 2) {
      setConfirmModal({
        isOpen: true,
        title: 'Selection Required',
        message: 'Select at least 2 team members below using the checkboxes to create a multi-owner preset.',
        confirmText: 'Understood',
        variant: 'info',
        isAlertOnly: true,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const selectedMembers = owners.filter((o) => selectedForPreset.includes(o.id));
    const combinedName = selectedMembers.map((m) => m.name).join(' & ');

    // Check if exists
    if (owners.some((o) => o.name.toLowerCase() === combinedName.toLowerCase())) {
      setConfirmModal({
        isOpen: true,
        title: 'Duplicate Preset',
        message: `A preset named "${combinedName}" already exists.`,
        confirmText: 'Understood',
        variant: 'warning',
        isAlertOnly: true,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const newPreset: OwnerItem = {
      id: `owner_preset_${Date.now()}`,
      name: combinedName,
      role: 'Combined Pod',
      avatarColor: '#8B5CF6',
    };

    onChange([...owners, newPreset]);
    setSelectedForPreset([]);
  };

  return (
    <div className="space-y-6">
      {/* Add New Owner */}
      <div className="bg-white dark:bg-[#050c21] p-5 rounded-xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors">
        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1">
          Add Team Member / Preset
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 font-medium">
          Add individual team engineers, QA testers, or predefined pair/pod combos.
        </p>

        <form onSubmit={handleAddOwner} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Chen or Alex & Jordan"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              required
            />
          </div>

          <div className="md:col-span-4">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Role / Pod (Optional)</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. QA Automation, Frontend"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Avatar Color</label>
            <ColorPickerPopover color={avatarColor} onChange={setAvatarColor} presets={AVATAR_COLORS} />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-lg text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Add Owner
            </button>
          </div>
        </form>
      </div>

      {/* Multi-Owner Preset Tool */}
      <div className="bg-rose-50/60 dark:bg-[#ff2d5f]/10 border border-rose-200/80 dark:border-[#ff2d5f]/25 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-black text-rose-950 dark:text-[#ff2d5f] uppercase tracking-wide">
            <Sparkles className="w-4 h-4 text-[#ff2d5f]" />
            Quick Multi-Owner Preset Builder
          </div>
          <p className="text-xs text-rose-900/80 dark:text-slate-300 mt-0.5 font-medium">
            Check 2+ members below to instantly generate a shared combo (e.g., &quot;Alex &amp; Jordan&quot;).
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateMultiOwnerPreset}
          disabled={selectedForPreset.length < 2}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff2d5f] hover:bg-[#e62252] disabled:opacity-40 text-white rounded-lg text-xs font-black shadow-md shadow-[#ff2d5f]/20 transition-all cursor-pointer"
        >
          <Users className="w-3.5 h-3.5 stroke-[2.5]" />
          Create Combined Preset ({selectedForPreset.length})
        </button>
      </div>

      {/* Existing Owners List */}
      <div className="bg-white dark:bg-[#050c21] rounded-xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="p-4 bg-slate-50/80 dark:bg-[#020612]/70 border-b border-slate-200 dark:border-[#142552] flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Active Team Members & Presets ({owners.length})
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select checkboxes to combine into pair preset</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-[#142552]/40">
          {owners.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No team members added yet. Use the form above to add engineers, QA, or team members.
            </div>
          ) : (
            owners.map((owner) => {
            const isSelected = selectedForPreset.includes(owner.id);
            const isCombo = owner.name.includes('&');

            return (
              <div
                key={owner.id}
                className="p-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelectForPreset(owner.id)}
                    className="w-4 h-4 text-[#ff2d5f] rounded border-slate-300 dark:border-slate-700 focus:ring-[#ff2d5f]"
                    title="Select to combine"
                  />

                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-2xs flex-shrink-0"
                    style={{ backgroundColor: owner.avatarColor }}
                  >
                    {isCombo ? <Users className="w-4 h-4" /> : owner.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={owner.name}
                      onChange={(e) => handleUpdate(owner.id, { name: e.target.value })}
                      className="text-xs font-bold text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-[#ff2d5f] focus:outline-none"
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        type="text"
                        value={owner.role || ''}
                        placeholder="Add role..."
                        onChange={(e) => handleUpdate(owner.id, { role: e.target.value })}
                        className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-[#ff2d5f] focus:outline-none"
                      />
                      {isCombo && (
                        <span className="text-[10px] bg-rose-100 dark:bg-[#ff2d5f]/20 text-rose-900 dark:text-[#ff2d5f] font-black px-1.5 py-0.2 rounded border border-rose-200 dark:border-[#ff2d5f]/30">
                          Pair Preset
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <ColorPickerPopover
                    label="Avatar:"
                    color={owner.avatarColor}
                    onChange={(c) => handleUpdate(owner.id, { avatarColor: c })}
                    presets={AVATAR_COLORS}
                  />

                  <button
                    type="button"
                    onClick={() => handleDelete(owner.id)}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                    title="Remove Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* Confirmation / Alert Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        isAlertOnly={confirmModal.isAlertOnly}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
