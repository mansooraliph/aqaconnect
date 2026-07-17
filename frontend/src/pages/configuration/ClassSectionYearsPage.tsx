import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toast } from '../../components/ui/toast';

interface AcademicYear {
  id: string;
  name: string;
}

interface PreviewRow {
  academicClassSectionId: string;
  className: string;
  sectionName: string;
  proposedCapacity: number | null;
}

interface AcademicClassSectionYear {
  id: string;
  capacity: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  academicClassSection: {
    academicClass: { name: string };
    academicSection: { name: string };
  };
  academicYear: { name: string };
}

/**
 * Class Section Years is generation-centric (preview then create), so it
 * doesn't fit the generic CrudPage list+form pattern used elsewhere.
 */
export function ClassSectionYearsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('configuration.class_section_years.manage');
  const canView = hasPermission('configuration.class_section_years.view');

  const [academicYearId, setAcademicYearId] = useState<string | undefined>(undefined);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const yearsQuery = useQuery({
    queryKey: ['academic-years', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicYear[]>(`/branches/${activeBranchId}/academic-years`)).data,
    enabled: Boolean(activeBranchId),
  });

  const generatedQuery = useQuery({
    queryKey: ['academic-class-section-years', activeBranchId, academicYearId],
    queryFn: async () =>
      (
        await api.get<AcademicClassSectionYear[]>(
          `/branches/${activeBranchId}/academic-class-section-years`,
          { params: { academicYearId } },
        )
      ).data,
    enabled: Boolean(activeBranchId && academicYearId && canView),
  });

  const runPreview = async () => {
    if (!academicYearId) return;
    setPreviewLoading(true);
    try {
      const { data } = await api.post<PreviewRow[]>(
        `/branches/${activeBranchId}/academic-class-section-years/preview-generation`,
        { academicYearId },
      );
      setPreview(data);
    } catch {
      toast.error('Failed to preview generation');
    } finally {
      setPreviewLoading(false);
    }
  };

  const runGenerate = async () => {
    if (!academicYearId) return;
    setGenerating(true);
    try {
      const { data } = await api.post<{ created: number; items: unknown[] }>(
        `/branches/${activeBranchId}/academic-class-section-years/generate`,
        { academicYearId },
      );
      toast.success(`Generated ${data.created} class section year${data.created === 1 ? '' : 's'}`);
      setPreview(null);
      generatedQuery.refetch();
    } catch {
      toast.error('Failed to generate class section years');
    } finally {
      setGenerating(false);
    }
  };

  const previewColumns: ColumnDef<PreviewRow, unknown>[] = [
    { header: 'Class', accessorKey: 'className' },
    { header: 'Section', accessorKey: 'sectionName' },
    { header: 'Proposed capacity', accessorKey: 'proposedCapacity' },
  ];

  const generatedColumns: ColumnDef<AcademicClassSectionYear, unknown>[] = [
    {
      header: 'Class',
      id: 'className',
      cell: ({ row }) => row.original.academicClassSection.academicClass.name,
    },
    {
      header: 'Section',
      id: 'sectionName',
      cell: ({ row }) => row.original.academicClassSection.academicSection.name,
    },
    { header: 'Capacity', accessorKey: 'capacity' },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-border bg-white p-5">
        <h1 className="text-[18px] font-bold text-text-primary">Class Section Years</h1>
        <p className="mt-2 text-sm text-text-muted">
          Generates the concrete class-section offerings for a given academic year, based on the
          Class Sections configured above.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <FilterSelect
            width="w-60"
            placeholder="Select academic year"
            value={academicYearId ?? ''}
            onChange={(value) => {
              setAcademicYearId(value);
              setPreview(null);
            }}
            options={(yearsQuery.data ?? []).map((year) => ({ label: year.name, value: year.id }))}
          />
          {canManage && (
            <>
              <Button
                variant="outline"
                onClick={runPreview}
                loading={previewLoading}
                disabled={!academicYearId}
              >
                Preview generation
              </Button>
              <Button onClick={runGenerate} loading={generating} disabled={!academicYearId}>
                Generate
              </Button>
            </>
          )}
        </div>

        {preview && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-card border border-blue/30 bg-blue-light p-3 text-sm text-text-primary">
              <strong>Preview only — nothing has been created yet</strong>
              <p className="mt-1 text-text-muted">
                This is a dry run of what Generate would create. Click Generate to actually create
                these rows.
              </p>
            </div>
            <DataTable<PreviewRow> columns={previewColumns} data={preview} pagination={false} />
          </div>
        )}

        {canView && academicYearId && (
          <div className="mt-6 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text-primary">Generated class section years</h2>
            <DataTable<AcademicClassSectionYear>
              columns={generatedColumns}
              data={generatedQuery.data ?? []}
              isLoading={generatedQuery.isLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
