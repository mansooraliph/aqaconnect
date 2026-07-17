import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Tone = 'blue' | 'amber' | 'purple' | 'green' | 'gray' | 'red' | 'orange';

const TONES: Record<Tone, string> = {
  blue: 'bg-blue-light text-blue',
  amber: 'bg-amber-50 text-amber',
  purple: 'bg-purple-100 text-purple-700',
  green: 'bg-green-50 text-green',
  gray: 'bg-table-head text-text-muted',
  red: 'bg-red/10 text-red',
  orange: 'bg-orange-100 text-orange-700',
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

/** Pill badge (20px radius per design system). */
export function Badge({ tone = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
