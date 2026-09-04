import { Transform } from 'class-transformer';

/**
 * Query params only arrive as arrays when repeated (`?x=a&x=b`); a lone
 * value stays a string. Wrap it so `@IsArray()` validators don't reject it.
 */
export function ToArray(): PropertyDecorator {
  return Transform(({ value }) => (value === undefined || Array.isArray(value) ? value : [value]));
}
