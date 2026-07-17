import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';

interface CurrentClass {
  id: string;
  className: string;
  sectionName: string;
  capacity: number | null;
  enrolledCount: number;
}

interface CurrentClassesResponse {
  academicYear: { id: string; name: string } | null;
  classes: CurrentClass[];
  note?: string;
}

export function CurrentClassesPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('academic.current_classes.view');

  const query = useQuery({
    queryKey: ['current-classes', activeBranchId],
    queryFn: async () =>
      (await api.get<CurrentClassesResponse>(`/branches/${activeBranchId}/current-classes`)).data,
    enabled: Boolean(activeBranchId && canView),
  });

  if (!canView) {
    return (
      <div className="rounded-card border border-border bg-white p-5">
        <PageHeader title="Current Classes" variant="plain" />
        <p className="mt-3 text-sm text-text-muted">
          You do not have permission to view current classes.
        </p>
      </div>
    );
  }

  const data = query.data;

  const columns: ColumnDef<CurrentClass, unknown>[] = [
    { header: 'Class', accessorKey: 'className' },
    { header: 'Section', accessorKey: 'sectionName' },
    {
      header: 'Capacity',
      accessorKey: 'capacity',
      cell: ({ row }) => row.original.capacity ?? '—',
    },
    { header: 'Enrolled', accessorKey: 'enrolledCount' },
    {
      header: 'Fill %',
      cell: ({ row }) =>
        row.original.capacity
          ? `${Math.round((row.original.enrolledCount / row.original.capacity) * 100)}%`
          : '—',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Current Classes" variant="plain" />
      <div className="rounded-card border border-border bg-white p-5">
        {query.isLoading ? (
          <div className="h-4 w-32 animate-pulse rounded bg-table-head" />
        ) : (
          <>
            {data && !data.academicYear && (
              <div className="mb-4 flex items-center gap-2 rounded-card border border-amber/30 bg-amber-50 px-4 py-3 text-sm text-amber">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {data.note ?? 'No current academic year set for this branch.'}
              </div>
            )}
            {data?.academicYear && (
              <h2 className="mb-4 text-base font-semibold text-text-primary">{data.academicYear.name}</h2>
            )}
            {data?.academicYear && <DataTable<CurrentClass> columns={columns} data={data.classes} />}
          </>
        )}
      </div>
    </div>
  );
}
