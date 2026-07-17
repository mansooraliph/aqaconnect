import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudPage } from '../../components/CrudPage';
import type { FieldDef } from '../../components/CrudFormModal';

interface FeeType {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Inactive', value: 'INACTIVE' },
    ],
  },
];

export function FeeTypesPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { list, create, update } = useBranchResource<FeeType>(activeBranchId, 'fee-types');

  const columns: ColumnDef<FeeType, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Status', accessorKey: 'status' },
  ];

  return (
    <CrudPage<FeeType>
      title="Fee Types"
      description="Categories of fees (e.g. Tuition, Transport, Admission) used when defining fee structures."
      data={list.data}
      loading={list.isLoading}
      columns={columns}
      fields={FIELDS}
      canManage={hasPermission('fees.fee_types.manage')}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, values) => update.mutateAsync({ id, payload: values })}
    />
  );
}
