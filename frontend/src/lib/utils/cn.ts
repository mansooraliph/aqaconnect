import { twMerge } from 'tailwind-merge';

/**
 * Classnames joiner with Tailwind conflict resolution — later classes win
 * over earlier ones for the same CSS property (e.g. a caller's `w-64`
 * overrides a component's built-in `w-full`), regardless of the order
 * Tailwind happens to emit rules in the generated stylesheet.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '));
}
