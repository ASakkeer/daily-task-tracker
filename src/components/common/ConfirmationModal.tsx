import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, HelpCircle, Info, X, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ConfirmationVariant = 'danger' | 'warning' | 'info' | 'cyan';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  isAlertOnly?: boolean; // When true, only shows an "OK / Dismiss" button
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  description,
  message,
  confirmLabel,
  confirmText,
  cancelLabel = 'Cancel',
  variant = 'cyan',
  isAlertOnly = false,
}) => {
  const handleClose = onClose || onCancel || (() => {});
  const resolvedDesc = description || message || '';
  const resolvedConfirmLabel = confirmLabel || confirmText || (isAlertOnly ? 'OK' : 'Confirm');

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, onConfirm]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: Trash2,
          iconBg: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800/60',
          btnClass: 'bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/25',
          borderAccent: 'border-rose-200 dark:border-rose-900/50',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60',
          btnClass: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/25',
          borderAccent: 'border-amber-200 dark:border-amber-900/50',
        };
      case 'info':
        return {
          icon: Info,
          iconBg: 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-800/60',
          btnClass: 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/25',
          borderAccent: 'border-blue-200 dark:border-blue-900/50',
        };
      case 'cyan':
      default:
        return {
          icon: HelpCircle,
          iconBg: 'bg-rose-100 dark:bg-rose-950/60 text-[#ff2d5f] border border-rose-300 dark:border-rose-800/60',
          btnClass: 'bg-[#ff2d5f] hover:bg-[#e62252] text-white font-bold shadow-md shadow-[#ff2d5f]/30',
          borderAccent: 'border-rose-200 dark:border-rose-900/50',
        };
    }
  };

  const { icon: Icon, iconBg, btnClass } = getVariantStyles();

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-[#050c21] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#142552] overflow-hidden flex flex-col text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 pb-3 flex items-start gap-3.5">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs', iconBg)}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 pr-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
              {resolvedDesc}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#08122f] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-[#020612]/90 border-t border-slate-200 dark:border-[#142552] flex items-center justify-end gap-2.5">
          {!isAlertOnly && (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#08122f] hover:bg-slate-100 dark:hover:bg-[#0c1a40] border border-slate-300 dark:border-[#142552] rounded-xl transition-all cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}

          <button
            type="button"
            autoFocus
            onClick={() => {
              onConfirm();
              handleClose();
            }}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer',
              btnClass
            )}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{resolvedConfirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
