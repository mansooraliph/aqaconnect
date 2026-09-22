import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { UploadCloud } from 'lucide-react';
import { useGlobalResource } from '../../hooks/useResource';
import { useBranches } from '../../hooks/useBranches';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { CrudPage } from '../../components/CrudPage';
import type { FieldDef } from '../../components/CrudFormModal';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/toast';

interface MasterAcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface PublishSummary {
  masterAcademicYearId: string;
  branches: { branchId: string; created: number; updated: number; skipped: number }[];
}

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name (e.g. 2026-2027)', type: 'text', required: true },
  { name: 'startDate', label: 'Start date', type: 'date', required: true },
  { name: 'endDate', label: 'End date', type: 'date', required: true },
];

/**
 * Super Admin's single, branch-less common academic year (see
 * MasterAcademicYearsService on the backend). Publishing copies name/dates
 * into every target branch's own AcademicYear — a branch year it has
 * already customized (created or edited itself) is never overwritten.
 */
export function MasterAcademicYearsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('master_academic_years.manage');
  const { list, create, update } = useGlobalResource<MasterAcademicYear>('master-academic-years');
  const branchesQuery = useBranches();

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<MasterAcademicYear | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);

  const openPublish = (year: MasterAcademicYear) => {
    setPublishTarget(year);
    setSelectedBranchIds((branchesQuery.data ?? []).filter((b) => b.isActive).map((b) => b.id));
    setPublishSummary(null);
    setPublishOpen(true);
  };

  const toggleBranch = (id: string) => {
    setSelectedBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const runPublish = async () => {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      const { data } = await api.post<PublishSummary>(`/master-academic-years/${publishTarget.id}/publish`, {
        branchIds: selectedBranchIds,
      });
      setPublishSummary(data);
      const totals = data.branches.reduce(
        (acc, b) => ({ created: acc.created + b.created, updated: acc.updated + b.updated, skipped: acc.skipped + b.skipped }),
        { created: 0, updated: 0, skipped: 0 },
      );
      toast.success(
        `Published to ${data.branches.length} branch(es): ${totals.created} created, ${totals.updated} synced, ${totals.skipped} kept as customized`,
      );
    } catch {
      toast.error('Failed to publish master academic year');
    } finally {
      setPublishing(false);
    }
  };

  const columns: ColumnDef<MasterAcademicYear, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Start', accessorKey: 'startDate', cell: ({ row }) => new Date(row.original.startDate).toLocaleDateString() },
    { header: 'End', accessorKey: 'endDate', cell: ({ row }) => new Date(row.original.endDate).toLocaleDateString() },
    ...(canManage
      ? [
          {
            header: 'Publish',
            id: 'publish',
            cell: ({ row }: { row: { original: MasterAcademicYear } }) => (
              <Button size="sm" variant="outline" onClick={() => openPublish(row.original)}>
                <UploadCloud className="h-4 w-4" />
                Publish
              </Button>
            ),
          } as ColumnDef<MasterAcademicYear, unknown>,
        ]
      : []),
  ];

  return (
    <>
      <CrudPage<MasterAcademicYear>
        title="Master Academic Years"
        description="The common academic years you maintain once and publish to every branch. A branch year it has already customized is never overwritten by a publish."
        data={list.data}
        loading={list.isLoading}
        columns={columns}
        fields={FIELDS}
        canManage={canManage}
        onCreate={(values) => create.mutateAsync(values)}
        onUpdate={(id, values) => update.mutateAsync({ id, payload: values })}
      />

      <Modal
        open={publishOpen}
        title={`Publish "${publishTarget?.name ?? ''}" to Branches`}
        onClose={() => setPublishOpen(false)}
        width="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Close
            </Button>
            <Button onClick={runPublish} disabled={selectedBranchIds.length === 0 || publishing}>
              {publishing ? 'Publishing…' : `Publish to ${selectedBranchIds.length} branch(es)`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-blue/30 bg-blue-light p-4 text-sm text-blue">
            A branch year it has already customized (created or edited on its own) is left untouched. Only years the
            branch hasn't touched get created or synced from the master.
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Branches</p>
            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {(branchesQuery.data ?? []).map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedBranchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />
                  {branch.name}
                </label>
              ))}
            </div>
          </div>

          {publishSummary && (
            <div className="rounded-card border border-border p-3 text-xs text-text-muted">
              <p className="mb-1 font-medium text-text-primary">Result</p>
              {publishSummary.branches.map((b) => (
                <p key={b.branchId}>
                  {b.branchId}: {b.created} created, {b.updated} synced, {b.skipped} kept as customized
                </p>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
