import { forwardRef } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils/cn';

const baseField =
  'w-full rounded-card border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue disabled:bg-table-alt disabled:opacity-60';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(baseField, className)} {...rest} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea ref={ref} className={cn(baseField, 'resize-y', className)} {...rest} />
  );
});

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/** Label + field + error wrapper for form rows. */
export function Field({ label, htmlFor, hint, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-red"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-text-faint">{hint}</p>}
      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  );
}
