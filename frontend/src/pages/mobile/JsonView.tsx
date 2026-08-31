import { Fragment } from 'react';

const TOKEN_PATTERN = /"(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(\.\d+)?([eE][+-]?\d+)?/g;

function tokenClass(token: string): string {
  if (token.startsWith('"')) {
    return token.endsWith(':') ? 'text-blue-700' : 'text-green-700';
  }
  if (token === 'true' || token === 'false') return 'text-purple-700';
  if (token === 'null') return 'text-text-faint';
  return 'text-amber-700';
}

/** Renders pretty-printed JSON with color-coded keys/strings/numbers/booleans/null. */
export function JsonView({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  const segments: { text: string; cls: string | null }[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) segments.push({ text: text.slice(lastIndex, start), cls: null });
    segments.push({ text: match[0], cls: tokenClass(match[0]) });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), cls: null });

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-card border border-border bg-table-alt px-3 py-2 text-xs">
      <code>
        {segments.map((seg, i) =>
          seg.cls ? (
            <span key={i} className={seg.cls}>
              {seg.text}
            </span>
          ) : (
            <Fragment key={i}>{seg.text}</Fragment>
          ),
        )}
      </code>
    </pre>
  );
}
