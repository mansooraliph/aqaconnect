import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Inbox,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface TablePagination {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Called when the user changes rows-per-page. Omit to hide the selector. */
  onLimitChange?: (limit: number) => void;
  /** Selectable page sizes (defaults to [10, 20, 50, 100]). */
  pageSizeOptions?: number[];
  /** Show the rows-per-page selector (default true; needs onLimitChange). */
  showPageSizeSelector?: boolean;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  isLoading?: boolean;
  /** Omit for simple client-side pagination over `data` (default page size 20). */
  pagination?: TablePagination | false;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  searchable?: boolean;
  /** Extra classes applied to a row's <tr>, e.g. a background tint for flagged rows. */
  rowClassName?: (row: T) => string | undefined;
}

/** Build a page-number list with ellipsis, e.g. [1,'…',4,5,6,'…',12]. */
function pageList(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

/**
 * Generic table. Pass `pagination` for server-side paging, omit it for local
 * (client-side) pagination over the full `data` array, or pass `false` to
 * disable pagination entirely and render every row.
 */
export function DataTable<T>({
  columns,
  data,
  isLoading,
  pagination,
  onRowClick,
  emptyMessage = 'No results found',
  searchable,
  rowClassName,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [localPage, setLocalPage] = useState(1);
  const [localLimit, setLocalLimit] = useState(20);

  const isLocal = pagination === undefined;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const allRows = table.getRowModel().rows;
  const effectivePagination: TablePagination | undefined = isLocal
    ? {
        page: localPage,
        limit: localLimit,
        total: allRows.length,
        onPageChange: setLocalPage,
        onLimitChange: setLocalLimit,
      }
    : pagination === false
      ? undefined
      : pagination;

  const rows =
    isLocal && effectivePagination
      ? allRows.slice(
          (effectivePagination.page - 1) * effectivePagination.limit,
          effectivePagination.page * effectivePagination.limit,
        )
      : allRows;

  const totalPages = effectivePagination
    ? Math.max(1, Math.ceil(effectivePagination.total / effectivePagination.limit))
    : 1;
  const from = effectivePagination
    ? (effectivePagination.page - 1) * effectivePagination.limit + 1
    : 0;
  const to = effectivePagination
    ? Math.min(effectivePagination.page * effectivePagination.limit, effectivePagination.total)
    : 0;

  const showSelector =
    !!effectivePagination?.onLimitChange && effectivePagination.showPageSizeSelector !== false;
  const baseOptions = effectivePagination?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
  const pageSizeOptions =
    effectivePagination && !baseOptions.includes(effectivePagination.limit)
      ? [...baseOptions, effectivePagination.limit].sort((a, b) => a - b)
      : baseOptions;

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white">
      {searchable && (
        <div className="border-b border-border p-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search…"
              className="h-9 w-full rounded-card border border-border pl-9 pr-3 text-sm focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-table-head">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={
                        canSort ? header.column.getToggleSortingHandler() : undefined
                      }
                      className={cn(
                        'px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-wide text-[#475569]',
                        canSort && 'cursor-pointer select-none',
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {canSort &&
                          (sortDir === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : sortDir === 'desc' ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-text-faint" />
                          ))}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((_c, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-table-head" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">
                  <div className="flex flex-col items-center justify-center gap-2 text-text-muted">
                    <Inbox className="h-8 w-8 text-text-faint" />
                    <span className="text-sm">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-t border-border transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-table-alt',
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-text-primary">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {effectivePagination && effectivePagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {showSelector && (
              <label className="flex items-center gap-2">
                <span className="whitespace-nowrap text-[13px] text-text-muted">
                  Rows per page:
                </span>
                <select
                  value={effectivePagination.limit}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    effectivePagination.onLimitChange?.(next);
                    effectivePagination.onPageChange(1);
                  }}
                  className="h-8 w-[72px] rounded-card border border-border bg-white px-2 text-[13px] text-text-primary focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                >
                  {pageSizeOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="whitespace-nowrap text-[13px] text-text-muted">
              Showing {from}-{to} of {effectivePagination.total}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden whitespace-nowrap text-[13px] text-text-muted sm:inline">
              Page {effectivePagination.page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <PagerButton
                disabled={effectivePagination.page <= 1}
                onClick={() => effectivePagination.onPageChange(effectivePagination.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </PagerButton>
              {pageList(effectivePagination.page, totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} className="px-2 text-text-faint">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => effectivePagination.onPageChange(p)}
                    className={cn(
                      'h-8 min-w-8 rounded-card px-2 text-sm transition-colors',
                      p === effectivePagination.page
                        ? 'bg-blue text-white'
                        : 'text-text-muted hover:bg-table-alt',
                    )}
                  >
                    {p}
                  </button>
                ),
              )}
              <PagerButton
                disabled={effectivePagination.page >= totalPages}
                onClick={() => effectivePagination.onPageChange(effectivePagination.page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </PagerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PagerButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-card text-text-muted transition-colors hover:bg-table-alt disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
