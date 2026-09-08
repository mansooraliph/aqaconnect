import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Activity, AlertTriangle, CalendarClock } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Field, Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils/cn';

interface RequestLog {
  id: string;
  userId: string | null;
  username: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
}

interface Summary {
  total_calls: number;
  calls_last_7_days: number;
  error_calls: number;
  top_endpoints: { method: string; path: string; count: number }[];
  calls_by_day: { day: string; count: number }[];
}

interface UserUsage {
  user_id: string | null;
  username: string | null;
  total_calls: number;
  error_calls: number;
  last_call_at: string;
}

type Tab = 'logs' | 'users';

const METHOD_TONE: Record<string, 'blue' | 'green' | 'amber' | 'red'> = {
  GET: 'blue',
  POST: 'green',
  PATCH: 'amber',
  DELETE: 'red',
};

function statusTone(status: number): 'green' | 'amber' | 'red' {
  if (status >= 500) return 'red';
  if (status >= 400) return 'amber';
  return 'green';
}

export function MobileApiUsageHistoryPage() {
  const [tab, setTab] = useState<Tab>('logs');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [method, setMethod] = useState('');
  const [path, setPath] = useState('');
  const [username, setUsername] = useState('');

  const summaryQuery = useQuery({
    queryKey: ['mobile-api-usage-summary'],
    queryFn: async () => (await api.get<Summary>('/mobile-api-usage/summary')).data,
  });

  const byUserQuery = useQuery({
    queryKey: ['mobile-api-usage-by-user'],
    queryFn: async () => (await api.get<{ data: UserUsage[] }>('/mobile-api-usage/by-user')).data,
    enabled: tab === 'users',
  });

  function viewUserLogs(name: string | null) {
    if (!name) return;
    setUsername(name);
    setPage(1);
    setTab('logs');
  }

  const logsQuery = useQuery({
    queryKey: ['mobile-api-usage-logs', page, limit, method, path, username],
    queryFn: async () =>
      (
        await api.get<{ data: RequestLog[]; meta: { total: number } }>('/mobile-api-usage/logs', {
          params: {
            page,
            per_page: limit,
            method: method || undefined,
            path: path || undefined,
            username: username || undefined,
          },
        })
      ).data,
  });

  const columns: ColumnDef<RequestLog, unknown>[] = [
    {
      header: 'Time',
      accessorKey: 'createdAt',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      header: 'Method',
      id: 'method',
      cell: ({ row }) => <Badge tone={METHOD_TONE[row.original.method] ?? 'gray'}>{row.original.method}</Badge>,
    },
    {
      header: 'Path',
      accessorKey: 'path',
      cell: ({ row }) => <code className="text-xs">{row.original.path}</code>,
    },
    {
      header: 'User',
      id: 'username',
      cell: ({ row }) => row.original.username ?? <span className="text-text-faint">—</span>,
    },
    {
      header: 'Status',
      id: 'statusCode',
      cell: ({ row }) => <Badge tone={statusTone(row.original.statusCode)}>{row.original.statusCode}</Badge>,
    },
    {
      header: 'Duration',
      accessorKey: 'durationMs',
      cell: ({ row }) => `${row.original.durationMs} ms`,
    },
  ];

  const userColumns: ColumnDef<UserUsage, unknown>[] = [
    {
      header: 'User',
      id: 'username',
      cell: ({ row }) => row.original.username ?? <span className="text-text-faint">—</span>,
    },
    {
      header: 'Total calls',
      accessorKey: 'total_calls',
    },
    {
      header: 'Errors',
      id: 'error_calls',
      cell: ({ row }) =>
        row.original.error_calls > 0 ? (
          <Badge tone="red">{row.original.error_calls}</Badge>
        ) : (
          <span className="text-text-faint">0</span>
        ),
    },
    {
      header: 'Last call',
      id: 'last_call_at',
      cell: ({ row }) => new Date(row.original.last_call_at).toLocaleString(),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => viewUserLogs(row.original.username)}>
          View logs
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Mobile API Usage History" variant="plain" />
      <p className="-mt-2 text-sm text-text-muted">
        Every call into the Mobile App API (<code className="rounded bg-table-alt px-1 py-0.5">/api/app/*</code>), logged
        automatically.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total calls"
          value={summaryQuery.data?.total_calls ?? 0}
          icon={Activity}
          isLoading={summaryQuery.isLoading}
        />
        <StatCard
          title="Calls (last 7 days)"
          value={summaryQuery.data?.calls_last_7_days ?? 0}
          icon={CalendarClock}
          isLoading={summaryQuery.isLoading}
        />
        <StatCard
          title="Error responses (4xx/5xx)"
          value={summaryQuery.data?.error_calls ?? 0}
          icon={AlertTriangle}
          isLoading={summaryQuery.isLoading}
        />
      </div>

      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'logs', label: 'Logs' },
          { key: 'users', label: 'Usage by User' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.key ? 'border-blue text-blue' : 'border-transparent text-text-muted hover:text-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'logs' && (
        <>
          {summaryQuery.data && summaryQuery.data.top_endpoints.length > 0 && (
            <div className="rounded-card border border-border bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-text-primary">Top endpoints</p>
              <div className="flex flex-col gap-2">
                {summaryQuery.data.top_endpoints.map((e) => (
                  <div key={`${e.method}-${e.path}`} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone={METHOD_TONE[e.method] ?? 'gray'}>{e.method}</Badge>
                      <code className="text-xs text-text-muted">{e.path}</code>
                    </div>
                    <span className="text-text-muted">{e.count} call{e.count === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Method">
              <select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-full rounded-card border border-border bg-white px-3 text-sm text-text-primary focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              >
                <option value="">All</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </Field>
            <Field label="Path contains">
              <Input value={path} onChange={(e) => { setPath(e.target.value); setPage(1); }} placeholder="e.g. /app/students" />
            </Field>
            <Field label="Username">
              <Input value={username} onChange={(e) => { setUsername(e.target.value); setPage(1); }} placeholder="e.g. admin" />
            </Field>
          </div>

          <DataTable<RequestLog>
            columns={columns}
            data={logsQuery.data?.data ?? []}
            isLoading={logsQuery.isLoading}
            emptyMessage="No API calls logged yet"
            pagination={{
              page,
              limit,
              total: logsQuery.data?.meta.total ?? 0,
              onPageChange: setPage,
              onLimitChange: setLimit,
            }}
          />
        </>
      )}

      {tab === 'users' && (
        <DataTable<UserUsage>
          columns={userColumns}
          data={byUserQuery.data?.data ?? []}
          isLoading={byUserQuery.isLoading}
          emptyMessage="No API calls logged yet"
        />
      )}
    </div>
  );
}
