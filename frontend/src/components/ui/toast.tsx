import { useSyncExternalStore } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function push(type: Toast['type'], message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, type, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3000);
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return toasts;
}

/** Mount once near the app root to render toasts fired via `toast.success/error`. */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot);

  if (items.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2 rounded-card border bg-white px-4 py-3 text-sm shadow-lg',
            t.type === 'success' ? 'border-green/30 text-green' : 'border-red/30 text-red',
          )}
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="text-text-primary">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
