import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudPage } from '../../components/CrudPage';
import type { FieldDef } from '../../components/CrudFormModal';

interface AcademicSection {
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
    editOnly: true, // Create DTO doesn't accept status — new sections default to ACTIVE server-side
    options: [
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Inactive', value: 'INACTIVE' },
    ],
  },
];

export function AcademicSectionsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { list, create, update } = useBranchResource<AcademicSection>(activeBranchId, 'academic-sections');

  const columns: ColumnDef<AcademicSection, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Status', accessorKey: 'status' },
  ];

  return (
    <CrudPage<AcademicSection>
      title="Academic Sections"
      description="Sections (e.g. A, B, C) that classes are split into."
      data={list.data}
      loading={list.isLoading}
      columns={columns}
      fields={FIELDS}
      canManage={hasPermission('configuration.academic_sections.manage')}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, values) => update.mutateAsync({ id, payload: values })}
    />
  );
}
