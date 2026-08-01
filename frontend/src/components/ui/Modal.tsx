import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  /** 'center' (default) is a centered dialog; 'right' is a full-height drawer anchored to the right edge. */
  position?: 'center' | 'right';
}

/** Generic modal shell used for add/edit forms and other dialogs. */
export function Modal({ open, title, onClose, children, footer, width = 'max-w-lg', position = 'center' }: Props) {
  if (!open) return null;

  if (position === 'right') {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
        <div className={cn('relative flex h-full w-full flex-col bg-white shadow-xl', width)}>
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-card p-1 text-text-faint hover:bg-table-alt hover:text-text-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className={cn('relative w-full rounded-card bg-white shadow-xl', width)}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-card p-1 text-text-faint hover:bg-table-alt hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
