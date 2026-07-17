import type { ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  isLoading?: boolean;
  /** Disable the confirm button (e.g. until a type-to-confirm phrase matches). */
  confirmDisabled?: boolean;
  children?: ReactNode; // optional extra body (e.g. a reason input)
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  isLoading,
  confirmDisabled,
  children,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={isLoading ? undefined : onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-[420px] rounded-card bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <div className="mt-2 text-sm text-text-muted">{message}</div>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant === 'danger' ? 'destructive' : 'primary'}
            onClick={onConfirm}
            loading={isLoading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
