import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Calendar } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/toast';

interface Holiday {
  id: string;
  name: string;
  date: string;
  isRecurringYearly: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
}

const fields: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'isRecurringYearly', label: 'Recurring yearly', type: 'checkbox' },
];

/**
 * Holidays needs a per-row "Apply to calendar" action alongside the usual
 * edit action, which doesn't fit CrudPage's single built-in action column,
 * so this builds its own list + form layout (like ClassSectionYearsPage).
 */
export function HolidaysPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('hr.holidays.manage');
  const queryClient = useQueryClient();

  const { list, create, update } = useBranchResource<Holiday>(activeBranchId, 'holidays');

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicYear[]>(`/branches/${activeBranchId}/academic-years`)).data,
    enabled: Boolean(activeBranchId),
  });
  const academicYearOptions = (academicYearsQuery.data ?? []).map((y) => ({
    label: y.name,
    value: y.id,
  }));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [applyTarget, setApplyTarget] = useState<Holiday | null>(null);
  const [applyYearId, setApplyYearId] = useState<string | undefined>(undefined);
  const [applying, setApplying] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: Holiday) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload: values });
        toast.success('Updated');
      } else {
        await create.mutateAsync(values);
        toast.success('Created');
      }
      setModalOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const openApply = (record: Holiday) => {
    setApplyTarget(record);
    setApplyYearId(undefined);
  };

  const closeApply = () => {
    setApplyTarget(null);
    setApplyYearId(undefined);
  };

  const submitApply = async () => {
    if (!applyTarget || !applyYearId) return;
    setApplying(true);
    try {
      await api.post(`/branches/${activeBranchId}/holidays/${applyTarget.id}/apply-to-calendar`, {
        academicYearId: applyYearId,
      });
      toast.success('Holiday applied to calendar');
      queryClient.invalidateQueries({ queryKey: ['calendar-days'] });
      closeApply();
    } catch {
      toast.error('Failed to apply holiday to calendar');
    } finally {
      setApplying(false);
    }
  };

  const columns: ColumnDef<Holiday, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Date',
      accessorKey: 'date',
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    {
      header: 'Recurring yearly',
      accessorKey: 'isRecurringYearly',
      cell: ({ row }) => (
        <Badge tone={row.original.isRecurringYearly ? 'blue' : 'gray'}>
          {row.original.isRecurringYearly ? 'Yes' : 'No'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            title="Apply to calendar"
            onClick={() => openApply(row.original)}
            disabled={!canManage}
          >
            <Calendar className="h-4 w-4" />
          </Button>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Holidays"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          )
        }
      />
      <p className="text-sm text-text-muted">
        Branch holidays. Use "Apply to calendar" to link a holiday into a specific academic year's
        calendar.
      </p>
      <DataTable<Holiday> columns={columns} data={list.data ?? []} isLoading={list.isLoading} />
      <CrudFormModal
        open={modalOpen}
        title={editing ? 'Edit Holiday' : 'Add Holiday'}
        fields={fields}
        initialValues={editing as unknown as Record<string, unknown> | undefined}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
      <Modal
        open={Boolean(applyTarget)}
        title={`Apply "${applyTarget?.name ?? ''}" to calendar`}
        onClose={closeApply}
        footer={
          <>
            <Button variant="outline" onClick={closeApply} disabled={applying}>
              Cancel
            </Button>
            <Button onClick={submitApply} loading={applying} disabled={!applyYearId}>
              Apply
            </Button>
          </>
        }
      >
        <Field label="Academic year" required>
          <Select
            placeholder={
              academicYearsQuery.isLoading ? 'Loading...' : 'Select academic year'
            }
            value={applyYearId ?? ''}
            onChange={(e) => setApplyYearId(e.target.value || undefined)}
            options={academicYearOptions}
            disabled={academicYearsQuery.isLoading}
          />
        </Field>
      </Modal>
    </div>
  );
}
