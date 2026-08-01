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
import { Field, Textarea } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toast } from '../../components/ui/toast';

interface Student {
  id: string;
  studentCode: string;
  name: string;
}

type StudentLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface StudentLeave {
  id: string;
  studentId: string;
  leaveDate: string;
  reason: string | null;
  leaveType: string | null;
  status: StudentLeaveStatus;
  approvalRemarks: string | null;
  creationRemarks: string | null;
  student: {
    id: string;
    name: string;
    studentCode: string;
  };
}

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
    ?.message;
  return serverMessage ?? fallback;
}

export function StudentLeavesPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canApply = hasPermission('student_management.student_leaves.apply');
  const canApprove = hasPermission('student_management.student_leaves.approve');

  const { list, basePath } = useBranchResource<StudentLeave>(activeBranchId, 'student-leaves');

  const studentsQuery = useQuery({
    queryKey: ['students', activeBranchId],
    queryFn: async () => (await api.get<Student[]>(`/branches/${activeBranchId}/students`)).data,
    enabled: Boolean(activeBranchId),
  });

  const studentOptions = (studentsQuery.data ?? []).map((s) => ({
    label: `${s.name} (${s.studentCode})`,
    value: s.id,
  }));

  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const applyFields: FieldDef[] = [
    { name: 'studentId', label: 'Student', type: 'select', required: true, options: studentOptions },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'endDate', label: 'End date', type: 'date', required: true },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true },
    { name: 'leaveType', label: 'Leave type', type: 'text' },
  ];

  const handleApply = async (values: Record<string, unknown>) => {
    setApplying(true);
    try {
      const { data } = await api.post<StudentLeave[]>(basePath, values);
      toast.success(`Created ${data.length} leave day(s)`);
      setApplyOpen(false);
      list.refetch();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to apply for leave'));
    } finally {
      setApplying(false);
    }
  };

  // Single-row approve/reject
  const [actionTarget, setActionTarget] = useState<StudentLeave | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const openAction = (record: StudentLeave, type: 'approve' | 'reject') => {
    setActionTarget(record);
    setActionType(type);
    setActionRemarks('');
    setActionError('');
  };

  const closeAction = () => {
    setActionTarget(null);
    setActionType(null);
    setActionRemarks('');
    setActionError('');
  };

  const submitAction = async () => {
    if (!actionTarget || !actionType) return;
    if (actionType === 'reject' && !actionRemarks.trim()) {
      setActionError('Approval remarks are required to reject a leave');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`${basePath}/${actionTarget.id}/${actionType}`, {
        approvalRemarks: actionRemarks || undefined,
      });
      toast.success(actionType === 'approve' ? 'Leave approved' : 'Leave rejected');
      list.refetch();
      closeAction();
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${actionType} leave`));
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk approve/reject
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const openBulk = (action: 'approve' | 'reject') => {
    setBulkAction(action);
    setBulkRemarks('');
    setBulkError('');
  };

  const closeBulk = () => {
    setBulkAction(null);
    setBulkRemarks('');
    setBulkError('');
  };

  const submitBulk = async () => {
    if (!bulkAction) return;
    if (bulkAction === 'reject' && !bulkRemarks.trim()) {
      setBulkError('Approval remarks are required to reject leaves');
      return;
    }
    setBulkLoading(true);
    try {
      const { data } = await api.post<{ updated: number; skipped: string[] }>(
        `${basePath}/bulk-manage`,
        {
          ids: selectedIds,
          action: bulkAction,
          approvalRemarks: bulkRemarks || undefined,
        },
      );
      toast.success(`Updated ${data.updated}, skipped ${data.skipped.length}`);
      setSelectedIds([]);
      list.refetch();
      closeBulk();
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${bulkAction} leaves`));
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  };

  const pendingRows = (list.data ?? []).filter((r) => r.status === 'PENDING');
  const allPendingSelected =
    pendingRows.length > 0 && pendingRows.every((r) => selectedIds.includes(r.id));

  const columns: ColumnDef<StudentLeave, unknown>[] = [
    ...(canApprove
      ? ([
          {
            id: 'select',
            header: () => (
              <Checkbox
                checked={allPendingSelected}
                indeterminate={selectedIds.length > 0 && !allPendingSelected}
                onChange={(checked) =>
                  setSelectedIds(checked ? pendingRows.map((r) => r.id) : [])
                }
                aria-label="Select all"
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                checked={selectedIds.includes(row.original.id)}
                disabled={row.original.status !== 'PENDING'}
                onChange={() => toggleSelected(row.original.id)}
                aria-label="Select row"
              />
            ),
          },
        ] as ColumnDef<StudentLeave, unknown>[])
      : []),
    {
      id: 'student',
      header: 'Student',
      cell: ({ row }) =>
        `${row.original.student.name} (${row.original.student.studentCode})`,
    },
    {
      header: 'Leave date',
      accessorKey: 'leaveDate',
      cell: ({ row }) =>
        row.original.leaveDate ? new Date(row.original.leaveDate).toLocaleDateString() : '-',
    },
    { header: 'Reason', accessorKey: 'reason', cell: ({ row }) => row.original.reason ?? '-' },
    { header: 'Leave type', accessorKey: 'leaveType', cell: ({ row }) => row.original.leaveType ?? '-' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: 'Approval remarks',
      accessorKey: 'approvalRemarks',
      cell: ({ row }) => row.original.approvalRemarks ?? '-',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        canApprove && row.original.status === 'PENDING' ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => openAction(row.original, 'approve')}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => openAction(row.original, 'reject')}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Student Leaves"
        variant="plain"
        actions={
          canApply && (
            <Button onClick={() => setApplyOpen(true)}>
              <Plus className="h-4 w-4" />
              Apply leave
            </Button>
          )
        }
      />

      {canApprove && selectedIds.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-primary">{selectedIds.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => openBulk('approve')}>
            Approve selected
          </Button>
          <Button size="sm" variant="danger" onClick={() => openBulk('reject')}>
            Reject selected
          </Button>
        </div>
      )}

      <DataTable<StudentLeave>
        columns={columns}
        data={list.data ?? []}
        isLoading={list.isLoading || studentsQuery.isLoading}
      />

      <CrudFormModal
        open={applyOpen}
        title="Apply leave"
        fields={applyFields}
        confirmLoading={applying}
        onCancel={() => setApplyOpen(false)}
        onSubmit={handleApply}
      />

      <Modal
        open={Boolean(actionTarget)}
        title={actionType === 'approve' ? 'Approve leave' : 'Reject leave'}
        onClose={closeAction}
        footer={
          <>
            <Button variant="outline" onClick={closeAction} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'primary'}
              onClick={submitAction}
              loading={actionLoading}
            >
              {actionType === 'reject' ? 'Reject' : 'Approve'}
            </Button>
          </>
        }
      >
        <Field
          label={actionType === 'reject' ? 'Approval remarks (required)' : 'Approval remarks (optional)'}
          required={actionType === 'reject'}
          error={actionError}
        >
          <Textarea rows={3} value={actionRemarks} onChange={(e) => setActionRemarks(e.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={Boolean(bulkAction)}
        title={bulkAction === 'approve' ? 'Approve selected leaves' : 'Reject selected leaves'}
        onClose={closeBulk}
        footer={
          <>
            <Button variant="outline" onClick={closeBulk} disabled={bulkLoading}>
              Cancel
            </Button>
            <Button
              variant={bulkAction === 'reject' ? 'destructive' : 'primary'}
              onClick={submitBulk}
              loading={bulkLoading}
            >
              {bulkAction === 'reject' ? 'Reject' : 'Approve'}
            </Button>
          </>
        }
      >
        <Field
          label={bulkAction === 'reject' ? 'Approval remarks (required)' : 'Approval remarks (optional)'}
          required={bulkAction === 'reject'}
          error={bulkError}
        >
          <Textarea rows={3} value={bulkRemarks} onChange={(e) => setBulkRemarks(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
