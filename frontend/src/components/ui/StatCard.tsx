import { ArrowDown, ArrowUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number; // percent; positive = up (green), negative = down (red)
  icon?: LucideIcon;
  isLoading?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  isLoading,
  valuePrefix,
  valueSuffix,
}: Props) {
  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-white p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-table-head" />
        <div className="mt-3 h-7 w-20 animate-pulse rounded bg-table-head" />
        <div className="mt-3 h-3 w-16 animate-pulse rounded bg-table-head" />
      </div>
    );
  }

  const trendUp = trend !== undefined && trend >= 0;

  return (
    <div className="rounded-card border border-border bg-white p-5">
      <div className="flex items-start justify-between">
        <span className="text-[13px] text-text-muted">{title}</span>
        {Icon && <Icon className="h-4 w-4 text-text-faint" />}
      </div>
      <div className="mt-2 text-[28px] font-bold leading-none text-text-primary">
        {valuePrefix}
        {value}
        {valueSuffix}
      </div>
      {(trend !== undefined || subtitle) && (
        <div className="mt-2 flex items-center gap-2">
          {trend !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                trendUp ? 'text-green' : 'text-red',
              )}
            >
              {trendUp ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )}
              {Math.abs(trend)}%
            </span>
          )}
          {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
