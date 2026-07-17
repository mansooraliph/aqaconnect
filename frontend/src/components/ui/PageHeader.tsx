import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type PageHeaderVariant = 'flat' | 'card' | 'plain';

export const PageHeaderContext = createContext<{ variant: PageHeaderVariant }>({
  variant: 'flat',
});

interface Props {
  title: string;
  actions?: ReactNode;
  /** Single filter row (search + selects) rendered directly under the title. */
  filters?: ReactNode;
  className?: string;
  variant?: PageHeaderVariant;
}

/**
 * Standard single-line page header used by every page. One row: title (18px) on
 * the left, actions on the right. An optional filters row sits directly beneath.
 */
export function PageHeader({ title, actions, filters, className, variant }: Props) {
  const context = useContext(PageHeaderContext);
  const activeVariant = variant ?? context.variant;

  return (
    <div
      className={cn(
        activeVariant === 'card'
          ? 'rounded-card border border-border bg-white px-6 py-4 shadow-sm'
          : activeVariant === 'flat'
            ? 'border-b border-border bg-white px-6 py-3'
            : // 'plain' — no card/border/background; title sits on the page.
              '',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-[18px] font-bold leading-tight text-text-primary">
          {title}
        </h1>
        {actions && <div className="flex items-end gap-2">{actions}</div>}
      </div>
      {filters && (
        <div className="mt-3 flex flex-wrap items-end gap-2">{filters}</div>
      )}
    </div>
  );
}
