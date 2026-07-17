import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudPage } from '../../components/CrudPage';
import { api } from '../../lib/api';
import type { FieldDef } from '../../components/CrudFormModal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/toast';

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name (e.g. 2026-2027)', type: 'text', required: true },
  { name: 'startDate', label: 'Start date', type: 'date', required: true },
  { name: 'endDate', label: 'End date', type: 'date', required: true },
];

export function AcademicYearsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { list, create, update } = useBranchResource<AcademicYear>(activeBranchId, 'academic-years');

  const makeCurrent = async (id: string) => {
    await api.post(`/branches/${activeBranchId}/academic-years/${id}/make-current`);
    toast.success('Set as current academic year');
    list.refetch();
  };

  const columns: ColumnDef<AcademicYear, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Start',
      accessorKey: 'startDate',
      cell: ({ row }) => new Date(row.original.startDate).toLocaleDateString(),
    },
    {
      header: 'End',
      accessorKey: 'endDate',
      cell: ({ row }) => new Date(row.original.endDate).toLocaleDateString(),
    },
    {
      header: 'Status',
      accessorKey: 'isCurrent',
      cell: ({ row }) =>
        row.original.isCurrent ? (
          <Badge tone="green">Current</Badge>
        ) : (
          hasPermission('configuration.academic_years.manage') && (
            <Button size="sm" variant="outline" onClick={() => makeCurrent(row.original.id)}>
              Make current
            </Button>
          )
        ),
    },
  ];

  return (
    <CrudPage<AcademicYear>
      title="Academic Years"
      description="The foundation of the academic structure — classes, sections, and calendars are all generated per year."
      data={list.data}
      loading={list.isLoading}
      columns={columns}
      fields={FIELDS}
      canManage={hasPermission('configuration.academic_years.manage')}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, values) => update.mutateAsync({ id, payload: values })}
    />
  );
}
