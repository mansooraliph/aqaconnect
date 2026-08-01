import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudPage } from '../../components/CrudPage';
import type { FieldDef } from '../../components/CrudFormModal';

interface AcademicClass {
  id: string;
  name: string;
  sortOrder: number | null;
  status: 'ACTIVE' | 'INACTIVE';
}

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'sortOrder', label: 'Sort order', type: 'number' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    editOnly: true, // Create DTO doesn't accept status — new classes default to ACTIVE server-side
    options: [
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Inactive', value: 'INACTIVE' },
    ],
  },
];

export function AcademicClassesPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { list, create, update } = useBranchResource<AcademicClass>(activeBranchId, 'academic-classes');

  const columns: ColumnDef<AcademicClass, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Sort order', accessorKey: 'sortOrder' },
    { header: 'Status', accessorKey: 'status' },
  ];

  return (
    <CrudPage<AcademicClass>
      title="Academic Classes"
      description="Classes (e.g. Grade 1, Grade 2) used across the academic structure."
      data={list.data}
      loading={list.isLoading}
      columns={columns}
      fields={FIELDS}
      canManage={hasPermission('configuration.academic_classes.manage')}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, values) => update.mutateAsync({ id, payload: values })}
    />
  );
}
