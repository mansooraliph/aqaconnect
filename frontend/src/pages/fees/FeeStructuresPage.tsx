import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { toast } from '../../components/ui/toast';

type FeeFrequency = 'ONE_TIME' | 'INSTALLMENTS';

interface AcademicClass {
  id: string;
  name: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface FeeType {
  id: string;
  name: string;
}

interface FeeStructure {
  id: string;
  academicClassId: string;
  academicYearId: string;
  feeTypeId: string;
  name: string;
  amount: number;
  currency: string;
  frequency: FeeFrequency;
  dueDate: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  academicClass: { name: string };
  academicYear: { name: string };
  feeType: { name: string };
}

interface Installment {
  id?: string;
  sequenceNo: number;
  name: string;
  amount: number | string;
  dueDate: string;
  status?: string;
}

interface PreviewItem {
  studentId: string;
  installmentId: string;
  installmentName: string;
  amount: number;
}

interface PreviewResult {
  enrolledStudentCount: number;
  installmentCount: number;
  demandsToCreate: number;
  items: PreviewItem[];
}

interface DemandStatus {
  pending: number;
  partiallyPaid: number;
  paid: number;
  overdue: number;
  total: number;
}

const EDIT_FIELDS: FieldDef[] = [
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

interface CreateFormState {
  academicClassId: string;
  academicYearId: string;
  feeTypeId: string;
  name: string;
  frequency: FeeFrequency;
  currency: string;
  amount: string;
  dueDate: string;
}

const EMPTY_CREATE_FORM: CreateFormState = {
  academicClassId: '',
  academicYearId: '',
  feeTypeId: '',
  name: '',
  frequency: 'ONE_TIME',
  currency: 'INR',
  amount: '',
  dueDate: '',
};

export function FeeStructuresPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('fees.structures.view');
  const canManage = hasPermission('fees.structures.manage');
  const canGenerateDemands = hasPermission('fees.demands.generate');
  const canViewDemands = hasPermission('fees.demands.view');

  const { list, create, update } = useBranchResource<FeeStructure>(activeBranchId, 'fee-structures');

  const classesQuery = useQuery({
    queryKey: ['academic-classes', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicClass[]>(`/branches/${activeBranchId}/academic-classes`)).data,
    enabled: Boolean(activeBranchId),
  });

  const yearsQuery = useQuery({
    queryKey: ['academic-years', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicYear[]>(`/branches/${activeBranchId}/academic-years`)).data,
    enabled: Boolean(activeBranchId),
  });

  const feeTypesQuery = useQuery({
    queryKey: ['fee-types', activeBranchId],
    queryFn: async () => (await api.get<FeeType[]>(`/branches/${activeBranchId}/fee-types`)).data,
    enabled: Boolean(activeBranchId),
  });

  const classOptions = (classesQuery.data ?? []).map((c) => ({ label: c.name, value: c.id }));
  const yearOptions = (yearsQuery.data ?? []).map((y) => ({ label: y.name, value: y.id }));
  const feeTypeOptions = (feeTypesQuery.data ?? []).map((f) => ({ label: f.name, value: f.id }));

  // Create modal (custom form — amount/dueDate visibility depends on frequency)
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const setCreateField = <K extends keyof CreateFormState>(name: K, value: CreateFormState[K]) => {
    setCreateForm((f) => ({ ...f, [name]: value }));
  };

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateErrors({});
    setCreateOpen(true);
  };

  const handleCreateSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!createForm.academicClassId) errors.academicClassId = 'Academic Class is required';
    if (!createForm.academicYearId) errors.academicYearId = 'Academic Year is required';
    if (!createForm.feeTypeId) errors.feeTypeId = 'Fee Type is required';
    if (!createForm.name.trim()) errors.name = 'Name is required';
    if (createForm.frequency === 'ONE_TIME') {
      if (createForm.amount === '') errors.amount = 'Amount is required';
      if (!createForm.dueDate) errors.dueDate = 'Due date is required';
    }
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreateSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        academicClassId: createForm.academicClassId,
        academicYearId: createForm.academicYearId,
        feeTypeId: createForm.feeTypeId,
        name: createForm.name,
        amount: createForm.frequency === 'INSTALLMENTS' ? 0 : Number(createForm.amount),
        frequency: createForm.frequency,
        currency: createForm.currency || 'INR',
      };
      if (createForm.frequency === 'ONE_TIME') {
        payload.dueDate = createForm.dueDate;
      }
      await create.mutateAsync(payload);
      toast.success('Fee structure created');
      setCreateOpen(false);
    } catch {
      toast.error('Failed to create fee structure');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Edit modal (simple name/status)
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<FeeStructure | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEdit = (record: FeeStructure) => {
    setEditing(record);
    setEditOpen(true);
  };

  const handleEditSubmit = async (values: Record<string, unknown>) => {
    if (!editing) return;
    setEditSubmitting(true);
    try {
      await update.mutateAsync({ id: editing.id, payload: values });
      toast.success('Updated');
      setEditOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Manage installments modal
  const [installmentsOpen, setInstallmentsOpen] = useState(false);
  const [installmentsStructure, setInstallmentsStructure] = useState<FeeStructure | null>(null);
  const [installmentsLoading, setInstallmentsLoading] = useState(false);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [installmentErrors, setInstallmentErrors] = useState<Record<number, Record<string, string>>>(
    {},
  );

  const openInstallments = async (record: FeeStructure) => {
    setInstallmentsStructure(record);
    setInstallmentsOpen(true);
    setInstallmentsLoading(true);
    setInstallmentErrors({});
    try {
      const { data } = await api.get<FeeStructure & { installments: Installment[] }>(
        `/branches/${activeBranchId}/fee-structures/${record.id}`,
      );
      setInstallments(
        (data.installments ?? [])
          .slice()
          .sort((a, b) => a.sequenceNo - b.sequenceNo)
          .map((i) => ({
            sequenceNo: i.sequenceNo,
            name: i.name,
            amount: i.amount,
            dueDate: i.dueDate ? i.dueDate.slice(0, 10) : '',
          })),
      );
    } catch {
      toast.error('Failed to load installments');
      setInstallments([]);
    } finally {
      setInstallmentsLoading(false);
    }
  };

  const updateInstallment = (index: number, patch: Partial<Installment>) => {
    setInstallments((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeInstallment = (index: number) => {
    setInstallments((rows) => rows.filter((_, i) => i !== index));
  };

  const addInstallment = () => {
    setInstallments((rows) => [
      ...rows,
      { sequenceNo: rows.length + 1, name: '', amount: '', dueDate: '' },
    ]);
  };

  const handleInstallmentsSubmit = async () => {
    if (!installmentsStructure) return;

    const errors: Record<number, Record<string, string>> = {};
    installments.forEach((i, idx) => {
      const rowErrors: Record<string, string> = {};
      if (!i.sequenceNo) rowErrors.sequenceNo = 'Required';
      if (!i.name.trim()) rowErrors.name = 'Required';
      if (i.amount === '' || i.amount === undefined) rowErrors.amount = 'Required';
      if (!i.dueDate) rowErrors.dueDate = 'Required';
      if (Object.keys(rowErrors).length > 0) errors[idx] = rowErrors;
    });
    setInstallmentErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setInstallmentsLoading(true);
      const payload = installments.map((i) => ({
        sequenceNo: i.sequenceNo,
        name: i.name,
        amount: Number(i.amount),
        dueDate: i.dueDate,
      }));
      await api.post(
        `/branches/${activeBranchId}/fee-structures/${installmentsStructure.id}/installments`,
        { installments: payload },
      );
      toast.success('Installments saved');
      setInstallmentsOpen(false);
      list.refetch();
    } catch {
      toast.error('Failed to save installments');
    } finally {
      setInstallmentsLoading(false);
    }
  };

  // Generate demands modal
  const [demandsOpen, setDemandsOpen] = useState(false);
  const [demandsStructure, setDemandsStructure] = useState<FeeStructure | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const demandStatusQuery = useQuery({
    queryKey: ['fee-demand-status', activeBranchId, demandsStructure?.id],
    queryFn: async () =>
      (
        await api.get<DemandStatus>(
          `/branches/${activeBranchId}/fee-structures/${demandsStructure?.id}/demand-status`,
        )
      ).data,
    enabled: Boolean(activeBranchId && demandsStructure && demandsOpen && canViewDemands),
  });

  const openDemands = (record: FeeStructure) => {
    setDemandsStructure(record);
    setPreview(null);
    setDemandsOpen(true);
  };

  const runPreview = async () => {
    if (!demandsStructure) return;
    setPreviewLoading(true);
    try {
      const { data } = await api.post<PreviewResult>(
        `/branches/${activeBranchId}/fee-structures/${demandsStructure.id}/preview-generation`,
      );
      setPreview(data);
    } catch {
      toast.error('Failed to preview demand generation');
    } finally {
      setPreviewLoading(false);
    }
  };

  const runGenerate = async () => {
    if (!demandsStructure) return;
    setGenerating(true);
    try {
      const { data } = await api.post<{ created: number; items: unknown[] }>(
        `/branches/${activeBranchId}/fee-structures/${demandsStructure.id}/generate-demands`,
      );
      toast.success(`Generated ${data.created} demand${data.created === 1 ? '' : 's'}`);
      setPreview(null);
      demandStatusQuery.refetch();
    } catch {
      toast.error('Failed to generate demands');
    } finally {
      setGenerating(false);
    }
  };

  const previewColumns: ColumnDef<PreviewItem, unknown>[] = [
    { header: 'Installment', accessorKey: 'installmentName' },
    { header: 'Amount', accessorKey: 'amount' },
  ];

  const columns: ColumnDef<FeeStructure, unknown>[] = [
    { id: 'class', header: 'Class', cell: ({ row }) => row.original.academicClass?.name },
    { id: 'year', header: 'Year', cell: ({ row }) => row.original.academicYear?.name },
    { id: 'feeType', header: 'Fee Type', cell: ({ row }) => row.original.feeType?.name },
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Frequency',
      accessorKey: 'frequency',
      cell: ({ row }) => (
        <Badge tone={row.original.frequency === 'ONE_TIME' ? 'blue' : 'purple'}>
          {row.original.frequency}
        </Badge>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }) =>
        row.original.frequency === 'ONE_TIME'
          ? `${row.original.amount} ${row.original.currency}`
          : 'See installments',
    },
    { header: 'Status', accessorKey: 'status' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {canManage && row.original.frequency === 'INSTALLMENTS' && (
            <Button size="sm" variant="outline" onClick={() => openInstallments(row.original)}>
              Manage installments
            </Button>
          )}
          {canGenerateDemands && (
            <Button size="sm" variant="outline" onClick={() => openDemands(row.original)}>
              Generate demands
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!canView) {
    return (
      <div className="rounded-card border border-border bg-white p-5">
        <p className="text-sm text-text-muted">You do not have permission to view fee structures.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Fee Structures"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          )
        }
      />
      <p className="-mt-2 text-sm text-text-muted">
        Defines what fees apply to a class/year/fee-type combination — either a single one-time
        amount, or a set of installments configured separately.
      </p>
      <DataTable<FeeStructure> columns={columns} data={list.data ?? []} isLoading={list.isLoading} />

      <Modal
        open={createOpen}
        title="Add Fee Structure"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} loading={createSubmitting}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Academic Class" required error={createErrors.academicClassId}>
            <Select
              value={createForm.academicClassId}
              onChange={(e) => setCreateField('academicClassId', e.target.value)}
              options={classOptions}
            />
          </Field>
          <Field label="Academic Year" required error={createErrors.academicYearId}>
            <Select
              value={createForm.academicYearId}
              onChange={(e) => setCreateField('academicYearId', e.target.value)}
              options={yearOptions}
            />
          </Field>
          <Field label="Fee Type" required error={createErrors.feeTypeId}>
            <Select
              value={createForm.feeTypeId}
              onChange={(e) => setCreateField('feeTypeId', e.target.value)}
              options={feeTypeOptions}
            />
          </Field>
          <Field label="Name" required error={createErrors.name}>
            <Input value={createForm.name} onChange={(e) => setCreateField('name', e.target.value)} />
          </Field>
          <Field label="Frequency" required>
            <Select
              value={createForm.frequency}
              onChange={(e) => setCreateField('frequency', e.target.value as FeeFrequency)}
              options={[
                { label: 'One-time', value: 'ONE_TIME' },
                { label: 'Installments', value: 'INSTALLMENTS' },
              ]}
            />
          </Field>
          {createForm.frequency === 'ONE_TIME' && (
            <>
              <Field
                label="Amount (used only for one-time fees)"
                required
                error={createErrors.amount}
              >
                <Input
                  type="number"
                  min={0}
                  value={createForm.amount}
                  onChange={(e) => setCreateField('amount', e.target.value)}
                />
              </Field>
              <Field label="Due date" required error={createErrors.dueDate}>
                <Input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateField('dueDate', e.target.value)}
                />
              </Field>
            </>
          )}
          {createForm.frequency === 'INSTALLMENTS' && (
            <p className="text-sm text-text-muted">
              Amount and due date are not set here — after creating, use "Manage installments" to
              define the individual installments.
            </p>
          )}
        </div>
      </Modal>

      <CrudFormModal
        open={editOpen}
        title="Edit Fee Structure"
        fields={EDIT_FIELDS}
        initialValues={editing ? (editing as unknown as Record<string, unknown>) : undefined}
        confirmLoading={editSubmitting}
        onCancel={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      <Modal
        open={installmentsOpen}
        title={
          installmentsStructure
            ? `Manage installments — ${installmentsStructure.name}`
            : 'Manage installments'
        }
        onClose={() => setInstallmentsOpen(false)}
        width="max-w-3xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setInstallmentsOpen(false)}
              disabled={installmentsLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleInstallmentsSubmit} loading={installmentsLoading}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {installments.map((row, index) => (
            <div key={index} className="flex items-end gap-2">
              <Field label="Seq" error={installmentErrors[index]?.sequenceNo}>
                <Input
                  type="number"
                  min={1}
                  value={row.sequenceNo}
                  onChange={(e) => updateInstallment(index, { sequenceNo: Number(e.target.value) })}
                />
              </Field>
              <Field label="Name" error={installmentErrors[index]?.name}>
                <Input
                  value={row.name}
                  onChange={(e) => updateInstallment(index, { name: e.target.value })}
                />
              </Field>
              <Field label="Amount" error={installmentErrors[index]?.amount}>
                <Input
                  type="number"
                  min={0}
                  value={row.amount}
                  onChange={(e) => updateInstallment(index, { amount: e.target.value })}
                />
              </Field>
              <Field label="Due date" error={installmentErrors[index]?.dueDate}>
                <Input
                  type="date"
                  value={row.dueDate}
                  onChange={(e) => updateInstallment(index, { dueDate: e.target.value })}
                />
              </Field>
              <Button variant="ghost" onClick={() => removeInstallment(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addInstallment}>
            <Plus className="h-4 w-4" />
            Add installment
          </Button>
        </div>
      </Modal>

      <Modal
        open={demandsOpen}
        title={demandsStructure ? `Generate demands — ${demandsStructure.name}` : 'Generate demands'}
        onClose={() => setDemandsOpen(false)}
        width="max-w-3xl"
      >
        {canViewDemands && (
          <div className="mb-4 flex flex-wrap gap-4">
            <StatCard title="Pending" value={demandStatusQuery.data?.pending ?? 0} />
            <StatCard title="Partially Paid" value={demandStatusQuery.data?.partiallyPaid ?? 0} />
            <StatCard title="Paid" value={demandStatusQuery.data?.paid ?? 0} />
            <StatCard title="Overdue" value={demandStatusQuery.data?.overdue ?? 0} />
            <StatCard title="Total" value={demandStatusQuery.data?.total ?? 0} />
          </div>
        )}

        {canGenerateDemands && (
          <div className="mb-4 flex gap-2">
            <Button variant="outline" onClick={runPreview} loading={previewLoading}>
              Preview
            </Button>
            <Button onClick={runGenerate} loading={generating}>
              Generate
            </Button>
          </div>
        )}

        {preview && (
          <>
            <div className="mb-3 rounded-card border border-blue/30 bg-blue-light p-4 text-sm">
              <p className="font-medium text-text-primary">Preview only — nothing has been created yet</p>
              <p className="mt-1 text-text-muted">
                Enrolled students: {preview.enrolledStudentCount}, installments: {preview.installmentCount},
                demands to create: {preview.demandsToCreate}.
              </p>
            </div>
            <DataTable<PreviewItem> columns={previewColumns} data={preview.items} />
          </>
        )}
      </Modal>
    </div>
  );
}
