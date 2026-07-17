/**
 * Builds a CSV string from row objects and a column definition, handling the
 * standard escaping rules (RFC 4180): any field containing a comma, double
 * quote, or newline is wrapped in double quotes, with internal double quotes
 * doubled. No external CSV library is needed for this.
 */
export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const escapeField = (value: unknown): string => {
    const raw = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const headerLine = columns.map((column) => escapeField(column.header)).join(',');
  const dataLines = rows.map((row) => columns.map((column) => escapeField(row[column.key])).join(','));

  return [headerLine, ...dataLines].join('\r\n');
}
