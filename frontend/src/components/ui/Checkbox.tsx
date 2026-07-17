import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils/cn';

interface Props {
  checked: boolean;
  /** Shows the indeterminate (dash) state when true and not fully checked. */
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  onClick?: (e: MouseEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Small controlled checkbox with indeterminate support (for select-all). */
export function Checkbox({
  checked,
  indeterminate,
  onChange,
  onClick,
  disabled,
  className,
  'aria-label': ariaLabel,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      onChange={(e) => onChange(e.target.checked)}
      className={cn(
        'h-4 w-4 cursor-pointer rounded border-border accent-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}
