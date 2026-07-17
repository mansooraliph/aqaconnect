import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudPage } from '../../components/CrudPage';
import { api } from '../../lib/api';
import type { FieldDef } from '../../components/CrudFormModal';

interface AcademicClass {
  id: string;
  name: string;
}

interface AcademicSection {
  id: string;
  name: string;
}

interface ClassSection {
  id: string;
  academicClassId: string;
  academicSectionId: string;
  capacity: number | null;
  academicClass: AcademicClass;
  academicSection: AcademicSection;
}

export function ClassSectionsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { list, create, update } = useBranchResource<ClassSection>(activeBranchId, 'academic-class-sections');

  const classesQuery = useQuery({
    queryKey: ['academic-classes', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicClass[]>(`/branches/${activeBranchId}/academic-classes`)).data,
    enabled: Boolean(activeBranchId),
  });

  const sectionsQuery = useQuery({
    queryKey: ['academic-sections', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicSection[]>(`/branches/${activeBranchId}/academic-sections`)).data,
    enabled: Boolean(activeBranchId),
  });

  const fields: FieldDef[] = [
    {
      name: 'academicClassId',
      label: 'Academic class',
      type: 'select',
      required: true,
      options: (classesQuery.data ?? []).map((cls) => ({ label: cls.name, value: cls.id })),
    },
    {
      name: 'academicSectionId',
      label: 'Academic section',
      type: 'select',
      required: true,
      options: (sectionsQuery.data ?? []).map((section) => ({ label: section.name, value: section.id })),
    },
    { name: 'capacity', label: 'Capacity', type: 'number' },
  ];

  const columns: ColumnDef<ClassSection, unknown>[] = [
    { header: 'Class', accessorKey: 'academicClass.name' },
    { header: 'Section', accessorKey: 'academicSection.name' },
    { header: 'Capacity', accessorKey: 'capacity' },
  ];

  return (
    <CrudPage<ClassSection>
      title="Class Sections"
      description="Pairs a class with a section (e.g. Grade 1 - A) and sets its default capacity."
      data={list.data}
      loading={list.isLoading}
      columns={columns}
      fields={fields}
      canManage={hasPermission('configuration.class_sections.manage')}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, values) =>
        update.mutateAsync({ id, payload: { capacity: values.capacity as number | null } })
      }
    />
  );
}
