import { cn } from '@/lib/utils/cn';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

/**
 * Status → colour mapping covering every status vocabulary used across the
 * portal (admissions/leaves approvals, active/inactive records, hifdh
 * progress, publication state). Unknown statuses fall back to neutral gray.
 */
const COLORS: Record<string, string> = {
  // approval-style workflows
  pending: 'bg-[#EFF6FF] text-[#1E40AF]',
  pre_approved: 'bg-[#EFF6FF] text-[#1E40AF]',
  approved: 'bg-[#DCFCE7] text-[#166534]',
  rejected: 'bg-[#FEE2E2] text-[#991B1B]',
  // active/inactive
  active: 'bg-[#DCFCE7] text-[#166534]',
  inactive: 'bg-[#F1F5F9] text-[#475569]',
  // progress-style
  in_progress: 'bg-[#FFEDD5] text-[#9A3412]',
  needs_review: 'bg-[#FEF3C7] text-[#92400E]',
  completed: 'bg-[#DCFCE7] text-[#166534]',
  verified: 'bg-[#DCFCE7] text-[#166534]',
  // publication
  draft: 'bg-[#F1F5F9] text-[#475569]',
  published: 'bg-[#DCFCE7] text-[#166534]',
  // generic
  cancelled: 'bg-[#F1F5F9] text-[#475569]',
  expired: 'bg-[#F1F5F9] text-[#475569]',
  // attendance
  present: 'bg-[#DCFCE7] text-[#166534]',
  absent: 'bg-[#FEE2E2] text-[#991B1B]',
  half_day: 'bg-[#FFEDD5] text-[#9A3412]',
  on_leave: 'bg-[#EFF6FF] text-[#1E40AF]',
  holiday: 'bg-[#F3E8FF] text-[#6B21A8]',
  // enrollment workflow
  transferred: 'bg-[#EFF6FF] text-[#1E40AF]',
  withdrawn: 'bg-[#F1F5F9] text-[#475569]',
  // fee demand / payment workflow
  partially_paid: 'bg-[#FFEDD5] text-[#9A3412]',
  paid: 'bg-[#DCFCE7] text-[#166534]',
  overdue: 'bg-[#FEE2E2] text-[#991B1B]',
};

function labelFor(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const color = COLORS[status.toLowerCase()] ?? 'bg-[#F1F5F9] text-[#475569]';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill font-medium',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-0.5 text-[13px]',
        color,
      )}
    >
      {labelFor(status)}
    </span>
  );
}
