import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  /**
   * Secondary text (e.g. a code) shown after the label. Native <option> can't
   * render a styled second line, so it's appended inline as "Label (sublabel)".
   */
  sublabel?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  width?: string;
  disabled?: boolean;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  width,
  disabled,
}: Props) {
  return (
    <div className={cn('flex flex-col gap-1', width)}>
      {label && <span className="text-xs font-medium text-text-muted">{label}</span>}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-card border border-border bg-white px-3 text-sm text-text-primary focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue disabled:bg-table-alt disabled:opacity-60"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.sublabel ? `${o.label} (${o.sublabel})` : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
