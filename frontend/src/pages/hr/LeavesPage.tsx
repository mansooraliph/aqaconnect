import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { toast } from '../../components/ui/toast';
import { cn } from '../../lib/utils/cn';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';

interface Employee {
  id: string;
  employeeCode: string;
  user: { firstName: string; lastName: string; email: string };
}

interface AcademicYear {
  id: string;
  name: string;
}

type LeaveStatus = 'PENDING' | 'PRE_APPROVED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface Leave {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  reason: string | null;
  status: LeaveStatus;
  approvalNote: string | null;
  employee: {
    id: string;
    userId: string;
    user: { firstName: string; lastName: string; email: string };
  } | null;
}

interface LeaveQuota {
  id: string;
  employeeId: string;
  leaveType: string;
  academicYearId: string | null;
  totalDays: number;
  usedDays: number;
  employee?: { user: { firstName: string; lastName: string } } | null;
}

interface EmployeeOption {
  label: string;
  value: string;
}

const TABS = [
  { key: 'requests', label: 'Leave Requests' },
  { key: 'quotas', label: 'Leave Quotas' },
] as const;

export function LeavesPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const canApply = hasPermission('hr.leaves.apply');
  const canApprove = hasPermission('hr.leaves.approve');
  const canManageQuotas = hasPermission('hr.leave_quotas.manage');

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['key']>('requests');

  const employeesQuery = useQuery({
    queryKey: ['employees', activeBranchId],
    queryFn: async () => (await api.get<Employee[]>(`/branches/${activeBranchId}/employees`)).data,
    enabled: Boolean(activeBranchId),
  });

  const employeeOptions = (employeesQuery.data ?? []).map((emp) => ({
    label: `${emp.user.firstName} ${emp.user.lastName} (${emp.employeeCode})`,
    value: emp.id,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Leaves" variant="plain" />
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-blue text-blue'
                : 'border-transparent text-text-muted hover:text-text-primary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'requests' && (
        <LeaveRequestsTab
          activeBranchId={activeBranchId}
          employeeOptions={employeeOptions}
          employeesLoading={employeesQuery.isLoading}
          canApply={canApply}
          canApprove={canApprove}
          currentUserId={currentUserId}
        />
      )}
      {activeTab === 'quotas' && (
        <LeaveQuotasTab
          activeBranchId={activeBranchId}
          employeeOptions={employeeOptions}
          employeesLoading={employeesQuery.isLoading}
          canManage={canManageQuotas}
        />
      )}
    </div>
  );
}

function LeaveRequestsTab({
  activeBranchId,
  employeeOptions,
  employeesLoading,
  canApply,
  canApprove,
  currentUserId,
}: {
  activeBranchId: string | undefined;
  employeeOptions: EmployeeOption[];
  employeesLoading: boolean;
  canApply: boolean;
  canApprove: boolean;
  currentUserId: string | undefined;
}) {
  const { list, create, queryKey } = useBranchResource<Leave>(activeBranchId, 'leaves');
  const [applyOpen, setApplyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [actionTarget, setActionTarget] = useState<Leave | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const applyFields: FieldDef[] = [
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employeeOptions },
    { name: 'leaveType', label: 'Leave type', type: 'text', required: true },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'endDate', label: 'End date', type: 'date', required: true },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ];

  const handleApply = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await create.mutateAsync({ ...values, isHalfDay: false });
      toast.success('Leave request submitted');
      setApplyOpen(false);
    } catch {
      toast.error('Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const openAction = (record: Leave, type: 'approve' | 'reject') => {
    setActionTarget(record);
    setActionType(type);
    setActionNote('');
  };

  const closeAction = () => {
    setActionTarget(null);
    setActionType(null);
    setActionNote('');
  };

  const submitAction = async () => {
    if (!actionTarget || !actionType) return;
    if (actionType === 'reject' && !actionNote.trim()) {
      toast.error('A reason is required to reject a leave request');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/branches/${activeBranchId}/leaves/${actionTarget.id}/${actionType}`, {
        approvalNote: actionNote || undefined,
      });
      toast.success(actionType === 'approve' ? 'Leave approved' : 'Leave rejected');
      list.refetch();
      closeAction();
    } catch {
      toast.error(`Failed to ${actionType} leave`);
    } finally {
      setActionLoading(false);
    }
  };

  const cancelLeave = async (record: Leave) => {
    try {
      await api.post(`/branches/${activeBranchId}/leaves/${record.id}/cancel`);
      toast.success('Leave cancelled');
      list.refetch();
    } catch {
      toast.error('Failed to cancel leave');
    }
  };

  void queryKey;

  const columns: ColumnDef<Leave, unknown>[] = [
    {
      id: 'employee',
      header: 'Employee',
      cell: ({ row }) =>
        row.original.employee
          ? `${row.original.employee.user.firstName} ${row.original.employee.user.lastName}`
          : '-',
    },
    { id: 'leaveType', header: 'Leave type', accessorKey: 'leaveType' },
    {
      id: 'dates',
      header: 'Dates',
      cell: ({ row }) =>
        `${new Date(row.original.startDate).toLocaleDateString()} - ${new Date(row.original.endDate).toLocaleDateString()}`,
    },
    {
      id: 'isHalfDay',
      header: 'Half day',
      cell: ({ row }) => (row.original.isHalfDay ? 'Yes' : 'No'),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const record = row.original;
        const isOwn = Boolean(currentUserId && record.employee?.userId === currentUserId);
        const canCancel =
          canApply && isOwn && (record.status === 'PENDING' || record.status === 'PRE_APPROVED');
        const canDecide = canApprove && (record.status === 'PENDING' || record.status === 'PRE_APPROVED');
        return (
          <div className="flex items-center gap-2">
            {canDecide && (
              <Button size="sm" variant="outline" onClick={() => openAction(record, 'approve')}>
                Approve
              </Button>
            )}
            {canDecide && (
              <Button size="sm" variant="danger" onClick={() => openAction(record, 'reject')}>
                Reject
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" onClick={() => cancelLeave(record)}>
                Cancel
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        {canApply && (
          <Button onClick={() => setApplyOpen(true)}>
            <Plus size={16} />
            Apply for leave
          </Button>
        )}
      </div>
      <DataTable<Leave>
        columns={columns}
        data={list.data ?? []}
        isLoading={list.isLoading || employeesLoading}
      />
      <CrudFormModal
        open={applyOpen}
        title="Apply for leave"
        fields={applyFields}
        confirmLoading={submitting}
        onCancel={() => setApplyOpen(false)}
        onSubmit={handleApply}
      />
      <ConfirmModal
        isOpen={Boolean(actionTarget)}
        onClose={closeAction}
        onConfirm={submitAction}
        title={actionType === 'approve' ? 'Approve leave' : 'Reject leave'}
        message={
          actionType === 'approve'
            ? 'Are you sure you want to approve this leave request?'
            : 'Are you sure you want to reject this leave request?'
        }
        confirmLabel={actionType === 'approve' ? 'Approve' : 'Reject'}
        confirmVariant={actionType === 'reject' ? 'danger' : 'primary'}
        isLoading={actionLoading}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">
            {actionType === 'reject' ? 'Reason (required)' : 'Note (optional)'}
          </span>
          <Textarea rows={3} value={actionNote} onChange={(e) => setActionNote(e.target.value)} />
        </label>
      </ConfirmModal>
    </>
  );
}

function LeaveQuotasTab({
  activeBranchId,
  employeeOptions,
  employeesLoading,
  canManage,
}: {
  activeBranchId: string | undefined;
  employeeOptions: EmployeeOption[];
  employeesLoading: boolean;
  canManage: boolean;
}) {
  const { list, create, update } = useBranchResource<LeaveQuota>(activeBranchId, 'leave-quotas');

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
  const [editing, setEditing] = useState<LeaveQuota | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const createFields: FieldDef[] = [
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employeeOptions },
    { name: 'leaveType', label: 'Leave type', type: 'text', required: true },
    { name: 'academicYearId', label: 'Academic year', type: 'select', options: academicYearOptions },
    { name: 'totalDays', label: 'Total days', type: 'number', required: true },
  ];

  const editFields: FieldDef[] = [
    { name: 'totalDays', label: 'Total days', type: 'number', required: true },
    { name: 'usedDays', label: 'Used days', type: 'number', required: true },
  ];

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: LeaveQuota) => {
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

  const columns: ColumnDef<LeaveQuota, unknown>[] = [
    {
      id: 'employee',
      header: 'Employee',
      cell: ({ row }) =>
        row.original.employee
          ? `${row.original.employee.user.firstName} ${row.original.employee.user.lastName}`
          : '-',
    },
    { id: 'leaveType', header: 'Leave type', accessorKey: 'leaveType' },
    { id: 'totalDays', header: 'Total days', accessorKey: 'totalDays' },
    { id: 'usedDays', header: 'Used days', accessorKey: 'usedDays' },
  ];

  const allColumns: ColumnDef<LeaveQuota, unknown>[] = canManage
    ? [
        ...columns,
        {
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
              <Pencil size={14} />
            </Button>
          ),
        },
      ]
    : columns;

  return (
    <>
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            Add
          </Button>
        )}
      </div>
      <p className="text-sm text-text-muted">
        Leave quotas define how many days of a given leave type an employee is entitled to,
        optionally scoped to an academic year.
      </p>
      <DataTable<LeaveQuota>
        columns={allColumns}
        data={list.data ?? []}
        isLoading={list.isLoading || employeesLoading}
      />
      <CrudFormModal
        open={modalOpen}
        title={editing ? 'Edit Leave Quota' : 'Add Leave Quota'}
        fields={editing ? editFields : createFields}
        initialValues={editing as unknown as Record<string, unknown> | undefined}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
