import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Field, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { toast } from '@/components/ui/toast';

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  return serverMessage ?? fallback;
}

interface Transaction {
  id: string;
  deviceSn: string;
  deviceAlias: string;
  userCode: string;
  userName: string | null;
  userType: 'STUDENT' | 'TEACHER' | 'STAFF' | null;
  punchTime: string;
  punchState: number;
  punchStateDisplay: string;
  source: string;
}

interface PagedResponse<T> {
  data: T[];
  meta: { current_page: number; per_page: number; total: number; last_page: number };
}

export function TransactionsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('devices.biometric_devices.manage');
  const basePath = `/branches/${activeBranchId}/biometric-devices`;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userType, setUserType] = useState('');
  const [punchState, setPunchState] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryKey = ['biometric-transactions', activeBranchId, page, limit, from, to, userType, punchState];
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await api.get<PagedResponse<Transaction>>(`${basePath}/transactions`, {
          params: {
            page,
            per_page: limit,
            from: from || undefined,
            to: to || undefined,
            userType: userType || undefined,
            punchState: punchState === '' ? undefined : Number(punchState),
          },
        })
      ).data,
    enabled: Boolean(activeBranchId),
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => (await api.delete(`${basePath}/transactions/${id}`)).data,
    onSuccess: () => {
      toast.success('Punch deleted');
      queryClient.invalidateQueries({ queryKey });
      setDeleteId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete punch')),
  });

  const columns: ColumnDef<Transaction, unknown>[] = [
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => (
        <div>
          <div className="text-text-primary">{row.original.userName ?? '-'}</div>
          <div className="text-xs text-text-faint">{row.original.userCode}</div>
        </div>
      ),
    },
    { id: 'userType', header: 'Type', cell: ({ row }) => row.original.userType ?? '-' },
    { id: 'punchTime', header: 'Time', cell: ({ row }) => new Date(row.original.punchTime).toLocaleString() },
    {
      id: 'punchState',
      header: 'State',
      cell: ({ row }) => (
        <Badge tone={row.original.punchState === 1 ? 'purple' : 'green'}>{row.original.punchStateDisplay}</Badge>
      ),
    },
    { id: 'device', header: 'Device', cell: ({ row }) => row.original.deviceAlias },
    { id: 'source', header: 'Source', cell: ({ row }) => row.original.source },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: Transaction } }) => (
              <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.original.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ),
          } as ColumnDef<Transaction, unknown>,
        ]
      : []),
  ];

  const meta = query.data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Attendance Punches" variant="plain" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Field label="From">
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        <div className="w-44">
          <Field label="To">
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        <div className="w-44">
          <Field label="User type">
            <Select
              options={[
                { label: 'Student', value: 'STUDENT' },
                { label: 'Teacher', value: 'TEACHER' },
                { label: 'Staff', value: 'STAFF' },
              ]}
              value={userType}
              placeholder="All"
              onChange={(e) => {
                setUserType(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        <div className="w-44">
          <Field label="Punch">
            <Select
              options={[
                { label: 'Check in', value: '0' },
                { label: 'Check out', value: '1' },
              ]}
              value={punchState}
              placeholder="All"
              onChange={(e) => {
                setPunchState(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        {(from || to || userType || punchState) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom('');
              setTo('');
              setUserType('');
              setPunchState('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <DataTable<Transaction>
        columns={columns}
        data={query.data?.data ?? []}
        isLoading={query.isLoading}
        pagination={{ page, limit, total: meta?.total ?? 0, onPageChange: setPage, onLimitChange: setLimit }}
      />

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteTransaction.mutate(deleteId)}
        title="Delete this punch?"
        message="This removes the attendance record. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={deleteTransaction.isPending}
      />
    </div>
  );
}
