import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
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
  /** Makes the placeholder a real, reselectable option (e.g. "All Surahs") instead of an unpickable prompt. */
  placeholderSelectable?: boolean;
}

function optionLabel(o: SelectOption) {
  return o.sublabel ? `${o.label} (${o.sublabel})` : o.label;
}

/**
 * Searchable dropdown — a plain <select> doesn't scale once a list runs past
 * a handful of options (e.g. 114 Surahs), so this is a text-filterable
 * combobox instead, built from scratch (no combobox library in this
 * project yet) but kept to the exact same props as the old native-select
 * version so every existing caller needed zero changes.
 */
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  width,
  disabled,
  placeholderSelectable = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? optionLabel(selected) : (placeholder ?? '');

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) => o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false),
      )
    : options;

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    // Input isn't mounted until `open` flips true, so focus it next tick.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={cn('relative flex flex-col gap-1', width)} ref={containerRef}>
      {label && <span className="text-xs font-medium text-text-muted">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-card border border-border bg-white px-3 text-left text-sm text-text-primary focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue disabled:bg-table-alt disabled:opacity-60"
      >
        <span className={cn('truncate', !selected && 'text-text-muted')}>{displayLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-card border border-border bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                  setQuery('');
                } else if (e.key === 'Enter' && filtered.length > 0) {
                  select(filtered[0].value);
                }
              }}
              placeholder="Search…"
              className="w-full text-sm text-text-primary focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {placeholderSelectable && placeholder && (
              <button
                type="button"
                onClick={() => select('')}
                className={cn(
                  'block w-full px-3 py-2 text-left text-sm text-text-muted hover:bg-table-alt',
                  value === '' && 'bg-primary/10 font-medium',
                )}
              >
                {placeholder}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-muted">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => select(o.value)}
                  className={cn(
                    'block w-full px-3 py-2 text-left text-sm hover:bg-table-alt',
                    o.value === value && 'bg-primary/10 font-medium',
                  )}
                >
                  {optionLabel(o)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
