import React, { useEffect, useRef } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel();
        }
        // Trap focus within dialog
        if (e.key === 'Tab' && dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled])'
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmColors =
    variant === 'danger'
      ? 'bg-error-container text-error hover:opacity-90'
      : variant === 'warning'
        ? 'bg-primary-container text-surface hover:opacity-90'
        : 'bg-gradient-to-r from-primary to-primary-container text-surface hover:opacity-90';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface/80 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-surface-container-highest rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl"
      >
        <div className="flex items-start gap-3 mb-4">
          {variant === 'danger' && (
            <ExclamationTriangleIcon className="h-6 w-6 text-error flex-shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div>
            <h2 id="confirm-dialog-title" className="font-editorial text-lg font-light text-on-surface">
              {title}
            </h2>
            <p id="confirm-dialog-message" className="text-sm text-on-surface-variant mt-1">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="btn-secondary text-sm py-2 px-4"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`text-sm py-2 px-4 rounded-full font-medium transition-opacity ${confirmColors}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
