import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Field } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Enrollment {
  id: string;
  userCode: string;
  studentId: string | null;
  employeeId: string | null;
  userType: 'STUDENT' | 'TEACHER' | 'STAFF' | null;
  name: string | null;
  status: 'PENDING' | 'ENROLLED' | null;
  deviceSn: string | null;
  deviceAlias: string | null;
  type: 'FP' | 'FACE' | 'PALM' | 'USERPIC' | 'BIOPHOTO';
  index: string;
  valid: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PagedResponse<T> {
  data: T[];
  meta: { current_page: number; per_page: number; total: number; last_page: number };
}

export function EnrollmentsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const basePath = `/branches/${activeBranchId}/biometric-devices`;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [type, setType] = useState('');
  const [userType, setUserType] = useState('');
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['biometric-enrollments', activeBranchId, page, limit, type, userType, search],
    queryFn: async () =>
      (
        await api.get<PagedResponse<Enrollment>>(`${basePath}/enrollments`, {
          params: { page, per_page: limit, type: type || undefined, userType: userType || undefined, search: search || undefined },
        })
      ).data,
    enabled: Boolean(activeBranchId),
  });

  const columns: ColumnDef<Enrollment, unknown>[] = [
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => (
        <div>
          <div className="text-text-primary">{row.original.name ?? '-'}</div>
          <div className="text-xs text-text-faint">{row.original.userCode}</div>
        </div>
      ),
    },
    {
      id: 'userType',
      header: 'Type',
      cell: ({ row }) => row.original.userType ?? '-',
    },
    { id: 'templateType', header: 'Template', cell: ({ row }) => row.original.type },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge tone={row.original.status === 'ENROLLED' ? 'green' : 'amber'}>{row.original.status ?? 'unknown'}</Badge>,
    },
    { id: 'device', header: 'Device', cell: ({ row }) => row.original.deviceAlias ?? row.original.deviceSn ?? '-' },
    { id: 'updatedAt', header: 'Updated', cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString() },
  ];

  const meta = query.data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Biometric Enrollments" variant="plain" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Field label="Template type">
            <Select
              options={[
                { label: 'Fingerprint', value: 'FP' },
                { label: 'Face', value: 'FACE' },
                { label: 'Palm', value: 'PALM' },
                { label: 'User photo', value: 'USERPIC' },
                { label: 'Bio photo', value: 'BIOPHOTO' },
              ]}
              value={type}
              placeholder="All types"
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        <div className="w-48">
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
        <div className="w-64">
          <Field label="Search">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Name or code…"
              className="h-[38px] w-full rounded-card border border-border px-3 text-sm focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
            />
          </Field>
        </div>
        {(type || userType || search) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setType('');
              setUserType('');
              setSearch('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <DataTable<Enrollment>
        columns={columns}
        data={query.data?.data ?? []}
        isLoading={query.isLoading}
        pagination={{ page, limit, total: meta?.total ?? 0, onPageChange: setPage, onLimitChange: setLimit }}
      />
    </div>
  );
}
