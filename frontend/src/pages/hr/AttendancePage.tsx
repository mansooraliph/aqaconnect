import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Textarea } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { Checkbox } from '../../components/ui/Checkbox';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toast } from '../../components/ui/toast';

interface Employee {
  id: string;
  employeeCode: string;
  user: { firstName: string; lastName: string; email: string };
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY';

interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  clockInAt: string | null;
  clockOutAt: string | null;
  remark: string | null;
  employee: { user: { firstName: string; lastName: string } } | null;
}

const STATUS_OPTIONS = [
  { label: 'Present', value: 'PRESENT' },
  { label: 'Absent', value: 'ABSENT' },
  { label: 'Half day', value: 'HALF_DAY' },
  { label: 'On leave', value: 'ON_LEAVE' },
  { label: 'Holiday', value: 'HOLIDAY' },
];

export function AttendancePage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('hr.attendance.manage');

  const [employeeId, setEmployeeId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [clockLoading, setClockLoading] = useState<'in' | 'out' | null>(null);

  const employeesQuery = useQuery({
    queryKey: ['employees', activeBranchId],
    queryFn: async () => (await api.get<Employee[]>(`/branches/${activeBranchId}/employees`)).data,
    enabled: Boolean(activeBranchId),
  });
  const employeeOptions = (employeesQuery.data ?? []).map((emp) => ({
    label: `${emp.user.firstName} ${emp.user.lastName} (${emp.employeeCode})`,
    value: emp.id,
  }));

  const basePath = `/branches/${activeBranchId}/attendances`;
  const queryKey = ['attendances', activeBranchId, employeeId, selectedDate];

  const attendanceQuery = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await api.get<Attendance[]>(basePath, {
          params: {
            employeeId: employeeId || undefined,
            date: selectedDate || undefined,
          },
        })
      ).data,
    enabled: Boolean(activeBranchId),
  });

  const clockIn = async () => {
    setClockLoading('in');
    try {
      await api.post(`${basePath}/clock-in`);
      toast.success('Clocked in');
      attendanceQuery.refetch();
    } catch {
      toast.error('Failed to clock in');
    } finally {
      setClockLoading(null);
    }
  };

  const clockOut = async () => {
    setClockLoading('out');
    try {
      await api.post(`${basePath}/clock-out`);
      toast.success('Clocked out');
      attendanceQuery.refetch();
    } catch {
      toast.error('Failed to clock out');
    } finally {
      setClockLoading(null);
    }
  };

  const [editTarget, setEditTarget] = useState<Attendance | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('PRESENT');
  const [editRemark, setEditRemark] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEdit = (record: Attendance) => {
    setEditTarget(record);
    setEditStatus(record.status);
    setEditRemark(record.remark ?? '');
  };

  const closeEdit = () => {
    setEditTarget(null);
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    setEditSubmitting(true);
    try {
      await api.patch(`${basePath}/${editTarget.id}`, {
        status: editStatus,
        remark: editRemark || undefined,
      });
      toast.success('Attendance updated');
      attendanceQuery.refetch();
      closeEdit();
    } catch {
      toast.error('Failed to update attendance');
    } finally {
      setEditSubmitting(false);
    }
  };

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState<string[]>([]);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('PRESENT');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<{ employeeIds?: string; date?: string }>({});

  const openBulk = () => {
    setBulkEmployeeIds([]);
    setBulkDate('');
    setBulkStatus('PRESENT');
    setBulkErrors({});
    setBulkOpen(true);
  };

  const closeBulk = () => {
    setBulkOpen(false);
  };

  const toggleBulkEmployee = (id: string, checked: boolean) => {
    setBulkEmployeeIds((prev) => (checked ? [...prev, id] : prev.filter((e) => e !== id)));
  };

  const submitBulk = async () => {
    const nextErrors: { employeeIds?: string; date?: string } = {};
    if (bulkEmployeeIds.length === 0) nextErrors.employeeIds = 'Select at least one employee';
    if (!bulkDate) nextErrors.date = 'Date is required';
    setBulkErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBulkSubmitting(true);
    try {
      await api.post(`${basePath}/bulk-mark`, {
        employeeIds: bulkEmployeeIds,
        date: bulkDate,
        status: bulkStatus,
      });
      toast.success('Attendance bulk-marked');
      attendanceQuery.refetch();
      closeBulk();
    } catch {
      toast.error('Failed to bulk mark attendance');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const columns: ColumnDef<Attendance, unknown>[] = [
    {
      id: 'employee',
      header: 'Employee',
      cell: ({ row }) =>
        row.original.employee
          ? `${row.original.employee.user.firstName} ${row.original.employee.user.lastName}`
          : '-',
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'clockInAt',
      header: 'Clock in',
      cell: ({ row }) =>
        row.original.clockInAt ? new Date(row.original.clockInAt).toLocaleTimeString() : '-',
    },
    {
      accessorKey: 'clockOutAt',
      header: 'Clock out',
      cell: ({ row }) =>
        row.original.clockOutAt ? new Date(row.original.clockOutAt).toLocaleTimeString() : '-',
    },
    {
      accessorKey: 'remark',
      header: 'Remark',
      cell: ({ row }) => row.original.remark ?? '-',
    },
  ];

  const allColumns: ColumnDef<Attendance, unknown>[] = canManage
    ? [
        ...columns,
        {
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <Button size="sm" variant="outline" onClick={() => openEdit(row.original)}>
              Edit
            </Button>
          ),
        },
      ]
    : columns;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attendance"
        variant="plain"
        actions={
          <>
            <Button variant="outline" onClick={clockIn} loading={clockLoading === 'in'}>
              Clock In
            </Button>
            <Button variant="outline" onClick={clockOut} loading={clockLoading === 'out'}>
              Clock Out
            </Button>
            {canManage && <Button onClick={openBulk}>Bulk mark</Button>}
          </>
        }
        filters={
          <>
            <FilterSelect
              value={employeeId}
              onChange={setEmployeeId}
              options={employeeOptions}
              placeholder="Filter by employee"
              width="w-60"
              disabled={employeesQuery.isLoading}
            />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 w-44"
            />
          </>
        }
      />

      <DataTable<Attendance>
        columns={allColumns}
        data={attendanceQuery.data ?? []}
        isLoading={attendanceQuery.isLoading}
      />

      <Modal
        open={Boolean(editTarget)}
        title="Edit attendance"
        onClose={closeEdit}
        footer={
          <>
            <Button variant="outline" onClick={closeEdit} disabled={editSubmitting}>
              Cancel
            </Button>
            <Button onClick={submitEdit} loading={editSubmitting}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Status" required>
            <Select
              options={STATUS_OPTIONS}
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
            />
          </Field>
          <Field label="Remark">
            <Textarea rows={3} value={editRemark} onChange={(e) => setEditRemark(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={bulkOpen}
        title="Bulk mark attendance"
        onClose={closeBulk}
        footer={
          <>
            <Button variant="outline" onClick={closeBulk} disabled={bulkSubmitting}>
              Cancel
            </Button>
            <Button onClick={submitBulk} loading={bulkSubmitting}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Employees" required error={bulkErrors.employeeIds}>
            <div className="max-h-48 overflow-y-auto rounded-card border border-border">
              {employeesQuery.isLoading ? (
                <div className="px-3 py-2 text-sm text-text-faint">Loading...</div>
              ) : employeeOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-text-faint">No employees found</div>
              ) : (
                employeeOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-table-alt"
                  >
                    <Checkbox
                      checked={bulkEmployeeIds.includes(opt.value)}
                      onChange={(checked) => toggleBulkEmployee(opt.value, checked)}
                    />
                    <span className="text-text-primary">{opt.label}</span>
                  </label>
                ))
              )}
            </div>
          </Field>
          <Field label="Date" required error={bulkErrors.date}>
            <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
          </Field>
          <Field label="Status" required>
            <Select
              options={STATUS_OPTIONS}
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
