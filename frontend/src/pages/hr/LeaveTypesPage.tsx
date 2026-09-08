import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudPage } from '../../components/CrudPage';
import type { FieldDef } from '../../components/CrudFormModal';

interface LeaveType {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  defaultDays: number | null;
}

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  {
    name: 'defaultDays',
    label: 'Default days / year',
    type: 'number',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    editOnly: true, // Create DTO doesn't accept status — new leave types default to ACTIVE server-side
    options: [
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Inactive', value: 'INACTIVE' },
    ],
  },
];

export function LeaveTypesPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { list, create, update } = useBranchResource<LeaveType>(activeBranchId, 'leave-types');

  const columns: ColumnDef<LeaveType, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Default days / year',
      id: 'defaultDays',
      cell: ({ row }) => row.original.defaultDays ?? '-',
    },
    { header: 'Status', accessorKey: 'status' },
  ];

  return (
    <CrudPage<LeaveType>
      title="Leave Types"
      description="Named leave types (Casual, Sick, Earned, ...). Set a default annual quota to auto-assign it to every new employee, or to prefill 'Assign to all employees' on the Leave Quotas tab."
      data={list.data}
      loading={list.isLoading}
      columns={columns}
      fields={FIELDS}
      canManage={hasPermission('hr.leave_types.manage')}
      formPosition="right"
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, values) => update.mutateAsync({ id, payload: values })}
    />
  );
}
