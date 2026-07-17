import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectItem {
  label: string;
  value: string | number;
}

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectItem[];
  placeholder?: string;
}

/** Form select styled to match Input (used inside Field wrappers). */
export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { options, placeholder, className, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-[38px] w-full rounded-card border border-border bg-white px-3 text-sm text-text-primary focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue disabled:bg-table-alt disabled:opacity-60',
        className,
      )}
      {...rest}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});
