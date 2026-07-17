import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/toast';

interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
}

interface AcademicClassSectionYear {
  id: string;
  academicClassSection: {
    academicClass: { name: string };
    academicSection: { name: string };
  };
  academicYear: { name: string };
}

type EnrollmentStatus = 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'COMPLETED';

interface Enrollment {
  id: string;
  studentId: string;
  academicClassSectionYearId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  transferredFromId: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
  };
  academicClassSectionYear: {
    academicClassSection: {
      academicClass: { name: string };
      academicSection: { name: string };
    };
    academicYear: { name: string };
  };
}

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
    ?.message;
  return serverMessage ?? fallback;
}

export function EnrollmentsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('student_management.enrollments.manage');
  const canView = hasPermission('student_management.enrollments.view');

  const { list, create, basePath } = useBranchResource<Enrollment>(activeBranchId, 'enrollments');

  const studentsQuery = useQuery({
    queryKey: ['students', activeBranchId],
    queryFn: async () => (await api.get<Student[]>(`/branches/${activeBranchId}/students`)).data,
    enabled: Boolean(activeBranchId),
  });

  const classSectionYearsQuery = useQuery({
    queryKey: ['academic-class-section-years', activeBranchId],
    queryFn: async () =>
      (
        await api.get<AcademicClassSectionYear[]>(
          `/branches/${activeBranchId}/academic-class-section-years`,
        )
      ).data,
    enabled: Boolean(activeBranchId),
  });

  const studentOptions = (studentsQuery.data ?? []).map((s) => ({
    label: `${s.firstName} ${s.lastName} (${s.studentCode})`,
    value: s.id,
  }));

  const classSectionYearOptions = (classSectionYearsQuery.data ?? []).map((csy) => ({
    label: `${csy.academicClassSection.academicClass.name} ${csy.academicClassSection.academicSection.name} (${csy.academicYear.name})`,
    value: csy.id,
  }));

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const createFields: FieldDef[] = [
    { name: 'studentId', label: 'Student', type: 'select', required: true, options: studentOptions },
    {
      name: 'academicClassSectionYearId',
      label: 'Class section year',
      type: 'select',
      required: true,
      options: classSectionYearOptions,
    },
  ];

  const handleCreate = async (values: Record<string, unknown>) => {
    setCreating(true);
    try {
      await create.mutateAsync(values);
      toast.success('Enrollment created');
      setCreateOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create enrollment'));
    } finally {
      setCreating(false);
    }
  };

  const [transferTarget, setTransferTarget] = useState<Enrollment | null>(null);
  const [transferTo, setTransferTo] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const openTransfer = (record: Enrollment) => {
    setTransferTarget(record);
    setTransferTo('');
    setTransferError('');
  };

  const closeTransfer = () => {
    setTransferTarget(null);
    setTransferTo('');
    setTransferError('');
  };

  const submitTransfer = async () => {
    if (!transferTarget) return;
    if (!transferTo) {
      setTransferError('Target class section year is required');
      return;
    }
    setTransferLoading(true);
    try {
      await api.post(`${basePath}/${transferTarget.id}/transfer`, {
        toAcademicClassSectionYearId: transferTo,
      });
      toast.success('Student transferred');
      list.refetch();
      closeTransfer();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to transfer student'));
    } finally {
      setTransferLoading(false);
    }
  };

  const [withdrawTarget, setWithdrawTarget] = useState<Enrollment | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const withdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      await api.post(`${basePath}/${withdrawTarget.id}/withdraw`);
      toast.success('Enrollment withdrawn');
      list.refetch();
      setWithdrawTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to withdraw enrollment'));
    } finally {
      setWithdrawing(false);
    }
  };

  const columns: ColumnDef<Enrollment, unknown>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: ({ row }) =>
        `${row.original.student.firstName} ${row.original.student.lastName} (${row.original.student.studentCode})`,
    },
    {
      id: 'class',
      header: 'Class',
      cell: ({ row }) =>
        row.original.academicClassSectionYear.academicClassSection.academicClass.name,
    },
    {
      id: 'section',
      header: 'Section',
      cell: ({ row }) =>
        row.original.academicClassSectionYear.academicClassSection.academicSection.name,
    },
    {
      id: 'academicYear',
      header: 'Academic year',
      cell: ({ row }) => row.original.academicClassSectionYear.academicYear.name,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: 'Enrolled at',
      accessorKey: 'enrolledAt',
      cell: ({ row }) =>
        row.original.enrolledAt ? new Date(row.original.enrolledAt).toLocaleDateString() : '-',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        canManage && row.original.status === 'ACTIVE' ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => openTransfer(row.original)}>
              Transfer
            </Button>
            <Button size="sm" variant="danger" onClick={() => setWithdrawTarget(row.original)}>
              Withdraw
            </Button>
          </div>
        ) : null,
    },
  ];

  if (!canView) {
    return (
      <div className="rounded-card border border-border bg-white p-5">
        <p className="text-sm text-text-muted">You do not have permission to view enrollments.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Enrollments"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New enrollment
            </Button>
          )
        }
      />
      <DataTable<Enrollment>
        columns={columns}
        data={list.data ?? []}
        isLoading={list.isLoading || studentsQuery.isLoading || classSectionYearsQuery.isLoading}
      />

      <CrudFormModal
        open={createOpen}
        title="New enrollment"
        fields={createFields}
        confirmLoading={creating}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <Modal
        open={Boolean(transferTarget)}
        title="Transfer student"
        onClose={closeTransfer}
        footer={
          <>
            <Button variant="outline" onClick={closeTransfer} disabled={transferLoading}>
              Cancel
            </Button>
            <Button onClick={submitTransfer} loading={transferLoading}>
              Transfer
            </Button>
          </>
        }
      >
        <Field label="New class section year" required error={transferError}>
          <Select
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            options={classSectionYearOptions}
          />
        </Field>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(withdrawTarget)}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={withdraw}
        title="Withdraw this enrollment?"
        message="This is a one-way change and cannot be undone."
        confirmLabel="Withdraw"
        confirmVariant="danger"
        isLoading={withdrawing}
      />
    </div>
  );
}
