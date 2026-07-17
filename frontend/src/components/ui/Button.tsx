import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'destructive';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue text-white hover:bg-blue/90 disabled:opacity-50',
  outline:
    'border border-border bg-white text-text-primary hover:bg-table-alt disabled:opacity-50',
  ghost: 'text-text-muted hover:bg-table-alt hover:text-text-primary',
  danger:
    'text-red hover:bg-red/10 disabled:opacity-40 disabled:hover:bg-transparent',
  destructive: 'bg-red text-white hover:bg-red/90 disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-card font-medium transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
