import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { useBranchResource } from '../../hooks/useResource';
import { Button } from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/toast';

interface Student {
  id: string;
  studentCode: string;
  name: string;
}

interface Surah {
  id: string;
  number: number;
  nameEnglish: string;
  totalAyahs: number;
}

// SurahHifdhStudentSchedule's own status vocabulary (matches legacy's
// completion_status) — distinct from StudentSurahProgress's, which keeps
// its original IN_PROGRESS/COMPLETED/VERIFIED terms.
type HifdhScheduleStatus = 'PENDING' | 'IN_PROGRESS' | 'NEEDS_REVIEW' | 'COMPLETED';
type HifdhStatus = 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';

interface TeacherRef {
  id: string;
  user: { firstName: string; lastName: string };
}

interface HifdhSchedule {
  id: string;
  studentId: string;
  surahId: string | null;
  scheduleNo: number;
  day: number | null;
  fromAyah: number | null;
  toAyah: number | null;
  scheduledDate: string;
  status: HifdhScheduleStatus;
  teacherId: string | null;
  teacher: TeacherRef | null;
  rescheduledFromId: string | null;
  rescheduledFrom: { scheduledDate: string } | null;
  rescheduledTo: { id: string; scheduledDate: string } | null;
  student: { name: string; studentCode: string };
  surah: { number: number; nameEnglish: string } | null;
  scheduleType: string | null;
  examName: string | null;
}

interface HalqaOption {
  id: string;
  name: string;
}

interface StudentProgressSummary {
  studentId: string;
  studentName: string;
  studentCode: string;
  halqaId: string | null;
  halqaName: string | null;
  totalSchedules: number;
  completedSchedules: number;
  completionPercentage: number;
  overdueCount: number;
}

interface StudentSurahProgress {
  id: string;
  studentId: string;
  surahId: string;
  ayahsCompleted: number;
  status: HifdhStatus;
  verifiedBy: { firstName: string; lastName: string | null } | null;
  student: { name: string; studentCode: string };
  surah: { number: number; nameEnglish: string; totalAyahs: number };
}

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
    ?.message;
  return serverMessage ?? fallback;
}

export function HifdhTrackingPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const studentsQuery = useQuery({
    queryKey: ['students', activeBranchId],
    queryFn: async () => (await api.get<Student[]>(`/branches/${activeBranchId}/students`)).data,
    enabled: Boolean(activeBranchId),
  });

  const surahsQuery = useQuery({
    queryKey: ['surahs'],
    queryFn: async () => (await api.get<Surah[]>('/surahs')).data,
  });

  const studentOptions = (studentsQuery.data ?? []).map((s) => ({
    label: `${s.name} (${s.studentCode})`,
    value: s.id,
  }));

  const surahOptions = (surahsQuery.data ?? []).map((s) => ({
    label: `${s.number}. ${s.nameEnglish}`,
    value: s.id,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Hifdh Tracking" variant="plain" />
      <div className="flex gap-1 border-b border-border">
        <span className="border-b-2 border-blue px-4 py-2 text-sm font-medium text-blue">
          Schedule and Progress
        </span>
      </div>
      <SchedulesTab
        activeBranchId={activeBranchId}
        hasPermission={hasPermission}
        studentOptions={studentOptions}
        studentsLoading={studentsQuery.isLoading}
        surahOptions={surahOptions}
        surahsLoading={surahsQuery.isLoading}
      />
    </div>
  );
}

interface SelectOption {
  label: string;
  value: string;
}

const SCHEDULE_STATUS_FILTER_OPTIONS = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Needs review', value: 'NEEDS_REVIEW' },
  { label: 'Completed', value: 'COMPLETED' },
];

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: 'red' }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-card border border-border bg-white p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <span className={tone === 'red' ? 'text-2xl font-semibold text-red' : 'text-2xl font-semibold text-text-primary'}>
        {value}
      </span>
    </div>
  );
}

function SchedulesTab({
  activeBranchId,
  hasPermission,
  studentOptions,
  studentsLoading,
  surahOptions,
  surahsLoading,
}: {
  activeBranchId: string | undefined;
  hasPermission: (key: string) => boolean;
  studentOptions: SelectOption[];
  studentsLoading: boolean;
  surahOptions: SelectOption[];
  surahsLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const canManage = hasPermission('academic.hifdh_schedules.manage');
  const canView = hasPermission('academic.hifdh_progress.view');

  const halqasQuery = useBranchResource<HalqaOption>(activeBranchId, 'halqas').list;
  const halqaOptions = (halqasQuery.data ?? []).map((h) => ({ label: h.name, value: h.id }));

  // ---- Filters ----
  const [filterStudentId, setFilterStudentId] = useState<string>('');
  const [filterHalqaId, setFilterHalqaId] = useState<string>('');

  const summaryQuery = useQuery({
    queryKey: ['hifdh-progress-summary', activeBranchId, filterHalqaId, filterStudentId],
    queryFn: async () =>
      (
        await api.get<StudentProgressSummary[]>(
          `/branches/${activeBranchId}/hifdh-schedules/progress-summary`,
          { params: { halqaId: filterHalqaId || undefined, studentId: filterStudentId || undefined } },
        )
      ).data,
    enabled: Boolean(activeBranchId && canView),
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['hifdh-schedules'] });
    queryClient.invalidateQueries({ queryKey: ['hifdh-progress-summary'] });
  };

  // ---- Selection + bulk/individual reschedule ----
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rescheduleTargets, setRescheduleTargets] = useState<StudentProgressSummary[] | null>(null);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const summary = summaryQuery.data ?? [];
  const totals = summary.reduce(
    (acc, s) => ({
      total: acc.total + s.totalSchedules,
      completed: acc.completed + s.completedSchedules,
      overdue: acc.overdue + s.overdueCount,
    }),
    { total: 0, completed: 0, overdue: 0 },
  );

  // ---- View schedule / progress drawers (mutually exclusive per kind) ----
  const [scheduleTarget, setScheduleTarget] = useState<StudentProgressSummary | null>(null);
  const [progressTarget, setProgressTarget] = useState<StudentProgressSummary | null>(null);

  const columns: ColumnDef<StudentProgressSummary, unknown>[] = [
    {
      id: 'select',
      header: '',
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.includes(row.original.studentId)}
          onChange={() => toggleSelected(row.original.studentId)}
        />
      ),
    },
    {
      header: 'Student Name',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.studentName}</span>
          <span className="text-xs text-text-muted">{row.original.studentCode}</span>
        </div>
      ),
    },
    {
      header: 'Halqa',
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.halqaName ?? '—'}</span>,
    },
    { header: 'Total Schedules', accessorKey: 'totalSchedules' },
    { header: 'Completed', accessorKey: 'completedSchedules' },
    {
      header: 'Completion Percentage',
      cell: ({ row }) => `${row.original.completionPercentage}%`,
    },
    {
      header: 'Overdue Count',
      cell: ({ row }) =>
        row.original.overdueCount > 0 ? (
          <Badge tone="red">{row.original.overdueCount}</Badge>
        ) : (
          row.original.overdueCount
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-green text-green hover:bg-green/10"
            onClick={() => setScheduleTarget(row.original)}
          >
            Schedule
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-blue text-blue hover:bg-blue/10"
            onClick={() => setProgressTarget(row.original)}
          >
            Progress
          </Button>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber text-amber hover:bg-amber/10"
              onClick={() => setRescheduleTargets([row.original])}
            >
              Reschedule
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <StatCard label="Total Students" value={summary.length} />
        <StatCard label="Completed" value={totals.completed} />
        <StatCard
          label="Completion %"
          value={totals.total > 0 ? `${Math.round((totals.completed / totals.total) * 10000) / 100}%` : '0%'}
        />
        <StatCard label="Overdue" value={totals.overdue} tone={totals.overdue > 0 ? 'red' : undefined} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Filter by student">
            <Select
              placeholder="All students"
              value={filterStudentId}
              onChange={(e) => setFilterStudentId(e.target.value)}
              options={[{ label: 'All students', value: '' }, ...studentOptions]}
              disabled={studentsLoading}
            />
          </Field>
          <Field label="Filter by halqa">
            <Select
              placeholder="All halqas"
              value={filterHalqaId}
              onChange={(e) => setFilterHalqaId(e.target.value)}
              options={[{ label: 'All halqas', value: '' }, ...halqaOptions]}
              disabled={halqasQuery.isLoading}
            />
          </Field>
        </div>
        {canManage && selectedIds.length > 0 && (
          <Button
            variant="outline"
            className="border-amber text-amber hover:bg-amber/10"
            onClick={() => setRescheduleTargets(summary.filter((s) => selectedIds.includes(s.studentId)))}
          >
            Reschedule selected ({selectedIds.length})
          </Button>
        )}
      </div>

      <DataTable<StudentProgressSummary>
        columns={columns}
        data={summary}
        isLoading={summaryQuery.isLoading}
      />

      <StudentScheduleModal
        activeBranchId={activeBranchId}
        student={scheduleTarget}
        surahOptions={surahOptions}
        surahsLoading={surahsLoading}
        hasPermission={hasPermission}
        onClose={() => setScheduleTarget(null)}
      />

      <StudentSurahProgressModal
        activeBranchId={activeBranchId}
        student={progressTarget}
        hasPermission={hasPermission}
        onClose={() => setProgressTarget(null)}
      />

      <BulkRescheduleModal
        activeBranchId={activeBranchId}
        students={rescheduleTargets}
        onClose={() => setRescheduleTargets(null)}
        onSuccess={() => {
          setSelectedIds([]);
          refetchAll();
        }}
      />
    </>
  );
}

/** Reschedules one or several students' whole remaining (not-yet-completed) schedule by a fixed date shift. */
function BulkRescheduleModal({
  activeBranchId,
  students,
  onClose,
  onSuccess,
}: {
  activeBranchId: string | undefined;
  students: StudentProgressSummary[] | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const todayStr = () => new Date().toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState<string>('');
  const [newStartDate, setNewStartDate] = useState<string>(todayStr());
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFromDate('');
    setNewStartDate(todayStr());
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!students || students.length === 0) return;
    setSubmitting(true);
    try {
      const { data } = await api.post<{ rescheduled: number; copied: number }>(
        `/branches/${activeBranchId}/hifdh-schedules/bulk-reschedule`,
        {
          studentIds: students.map((s) => s.studentId),
          newStartDate: newStartDate || todayStr(),
          fromDate: fromDate || undefined,
        },
      );
      toast.success(
        `Rescheduled ${data.rescheduled} schedule row${data.rescheduled === 1 ? '' : 's'}` +
          (data.copied > 0 ? `, carried over ${data.copied} completed row${data.copied === 1 ? '' : 's'}` : ''),
      );
      reset();
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reschedule'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(students)}
      title={
        students
          ? students.length === 1
            ? `Reschedule — ${students[0].studentName}`
            : `Reschedule ${students.length} students`
          : ''
      }
      onClose={handleClose}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            OK
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-muted">
        Shifts every not-yet-completed schedule row by the same number of days, so the gaps between
        days are kept. Completed rows are carried over unchanged (same date and status) so their
        history isn't lost. New rows are created either way — the originals are kept for history and
        marked as superseded, and no longer count toward totals.
      </p>
      {students && students.length > 1 && (
        <ul className="mt-3 max-h-24 list-disc overflow-y-auto pl-5 text-sm text-text-muted">
          {students.map((s) => (
            <li key={s.studentId}>{s.studentName}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Field label="Only shift schedules from date (optional)">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Field>
        <Field label="New start date" hint="Defaults to today if left blank">
          <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}


/** Right-side, half-width drawer listing one student's full day-wise Hifdh schedule. */
function StudentScheduleModal({
  activeBranchId,
  student,
  surahOptions,
  surahsLoading,
  hasPermission,
  onClose,
}: {
  activeBranchId: string | undefined;
  student: StudentProgressSummary | null;
  surahOptions: SelectOption[];
  surahsLoading: boolean;
  hasPermission: (key: string) => boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canMark = hasPermission('academic.hifdh_progress.mark');

  const [filterSurahId, setFilterSurahId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFromDay, setFilterFromDay] = useState<string>('');
  const [filterToDay, setFilterToDay] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  const scheduleQueryKey = [
    'hifdh-schedules',
    activeBranchId,
    student?.studentId,
    filterSurahId,
    filterStatus,
    filterFromDay,
    filterToDay,
    filterFromDate,
    filterToDate,
  ];

  const scheduleQuery = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: async () =>
      (
        await api.get<HifdhSchedule[]>(`/branches/${activeBranchId}/hifdh-schedules`, {
          params: {
            studentId: student?.studentId,
            surahId: filterSurahId || undefined,
            status: filterStatus || undefined,
            fromDay: filterFromDay || undefined,
            toDay: filterToDay || undefined,
            fromDate: filterFromDate || undefined,
            toDate: filterToDate || undefined,
          },
        })
      ).data,
    enabled: Boolean(activeBranchId && student),
  });

  const rows = scheduleQuery.data ?? [];

  // ---- Bulk mark progress ----
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMarking, setBulkMarking] = useState(false);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  // This component stays mounted (the Modal just hides) between opens, so
  // a stale selection from the previous student must be cleared explicitly.
  useEffect(() => {
    setSelectedIds([]);
  }, [student?.studentId]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const bulkMark = async (action: 'mark-in-progress' | 'mark-completed') => {
    if (selectedIds.length === 0) return;
    setBulkMarking(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => api.post(`/branches/${activeBranchId}/hifdh-schedules/${id}/${action}`)),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const succeeded = results.length - failed;
      if (succeeded > 0) toast.success(`Updated ${succeeded} schedule row${succeeded === 1 ? '' : 's'}`);
      if (failed > 0) toast.error(`Failed to update ${failed} row${failed === 1 ? '' : 's'}`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['hifdh-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['hifdh-progress-summary'] });
    } finally {
      setBulkMarking(false);
    }
  };

  const columns: ColumnDef<HifdhSchedule, unknown>[] = [
    ...(canMark
      ? ([
          {
            id: 'select',
            header: () => (
              <Checkbox
                checked={allSelected}
                indeterminate={selectedIds.length > 0 && !allSelected}
                onChange={(checked) => setSelectedIds(checked ? rows.map((r) => r.id) : [])}
                aria-label="Select all"
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                checked={selectedIds.includes(row.original.id)}
                onChange={() => toggleSelected(row.original.id)}
                aria-label="Select row"
              />
            ),
          } as ColumnDef<HifdhSchedule, unknown>,
        ] as ColumnDef<HifdhSchedule, unknown>[])
      : []),
    {
      header: 'Day',
      accessorKey: 'day',
      cell: ({ row }) => row.original.day ?? '-',
    },
    {
      header: 'Surah',
      cell: ({ row }) =>
        row.original.surah
          ? `${row.original.surah.number}. ${row.original.surah.nameEnglish}`
          : row.original.examName ?? '—',
    },
    {
      header: 'Ayahs',
      cell: ({ row }) =>
        row.original.fromAyah !== null && row.original.toAyah !== null
          ? `${row.original.fromAyah}-${row.original.toAyah}`
          : '—',
    },
    {
      header: 'Scheduled date',
      cell: ({ row }) => {
        const date = row.original.scheduledDate ? new Date(row.original.scheduledDate).toLocaleDateString() : '-';
        return `${date} (${row.original.scheduleNo})`;
      },
    },
    {
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <Modal
      open={Boolean(student)}
      title={student ? `Day-wise Schedule — ${student.studentName}` : ''}
      onClose={onClose}
      position="right"
      width="w-3/4"
    >
      <div className="mb-3 flex flex-nowrap items-end gap-3 overflow-x-auto">
        <div className="w-40 shrink-0">
          <Field label="Filter by surah">
            <Select
              placeholder="All surahs"
              value={filterSurahId}
              onChange={(e) => setFilterSurahId(e.target.value)}
              options={[{ label: 'All surahs', value: '' }, ...surahOptions]}
              disabled={surahsLoading}
            />
          </Field>
        </div>
        <div className="w-36 shrink-0">
          <Field label="Filter by status">
            <Select
              placeholder="All statuses"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[{ label: 'All statuses', value: '' }, ...SCHEDULE_STATUS_FILTER_OPTIONS]}
            />
          </Field>
        </div>
        <div className="w-20 shrink-0">
          <Field label="From day">
            <Input
              type="number"
              min={1}
              value={filterFromDay}
              onChange={(e) => setFilterFromDay(e.target.value)}
            />
          </Field>
        </div>
        <div className="w-20 shrink-0">
          <Field label="To day">
            <Input
              type="number"
              min={1}
              value={filterToDay}
              onChange={(e) => setFilterToDay(e.target.value)}
            />
          </Field>
        </div>
        <div className="w-36 shrink-0">
          <Field label="From date">
            <Input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="w-36 shrink-0">
          <Field label="To date">
            <Input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
          </Field>
        </div>
      </div>
      {canMark && selectedIds.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-text-muted">{selectedIds.length} selected</span>
          <Button
            size="sm"
            variant="outline"
            loading={bulkMarking}
            onClick={() => bulkMark('mark-in-progress')}
          >
            Mark In Progress
          </Button>
          <Button size="sm" loading={bulkMarking} onClick={() => bulkMark('mark-completed')}>
            Mark Completed
          </Button>
        </div>
      )}
      <DataTable<HifdhSchedule> columns={columns} data={rows} isLoading={scheduleQuery.isLoading} />
    </Modal>
  );
}

/** Right-side, half-width drawer listing one student's cumulative per-surah progress. */
function StudentSurahProgressModal({
  activeBranchId,
  student,
  hasPermission,
  onClose,
}: {
  activeBranchId: string | undefined;
  student: StudentProgressSummary | null;
  hasPermission: (key: string) => boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canVerify = hasPermission('academic.hifdh_progress.verify');

  const progressQuery = useQuery({
    queryKey: ['student-surah-progress', activeBranchId, student?.studentId],
    queryFn: async () =>
      (
        await api.get<StudentSurahProgress[]>(`/branches/${activeBranchId}/student-surah-progress`, {
          params: { studentId: student?.studentId },
        })
      ).data,
    enabled: Boolean(activeBranchId && student),
  });

  const verifyMutation = useMutation({
    mutationFn: async (row: StudentSurahProgress) =>
      (
        await api.post(
          `/branches/${activeBranchId}/student-surah-progress/${row.studentId}/${row.surahId}/verify`,
        )
      ).data,
    onSuccess: () => {
      toast.success('Verified');
      queryClient.invalidateQueries({ queryKey: ['student-surah-progress'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to verify')),
  });

  const columns: ColumnDef<StudentSurahProgress, unknown>[] = [
    {
      header: 'Surah',
      cell: ({ row }) => `${row.original.surah.number}. ${row.original.surah.nameEnglish}`,
    },
    {
      header: 'Progress',
      cell: ({ row }) => `${row.original.ayahsCompleted} / ${row.original.surah.totalAyahs}`,
    },
    {
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: 'Verified by',
      cell: ({ row }) =>
        row.original.verifiedBy
          ? `${row.original.verifiedBy.firstName} ${row.original.verifiedBy.lastName ?? ''}`.trim()
          : '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        canVerify && row.original.status === 'COMPLETED' ? (
          <Button
            size="sm"
            loading={verifyMutation.isPending}
            onClick={() => verifyMutation.mutate(row.original)}
          >
            Verify
          </Button>
        ) : null,
    },
  ];

  return (
    <Modal
      open={Boolean(student)}
      title={student ? `Progress by Surah — ${student.studentName}` : ''}
      onClose={onClose}
      position="right"
      width="w-3/4"
    >
      <DataTable<StudentSurahProgress>
        columns={columns}
        data={progressQuery.data ?? []}
        isLoading={progressQuery.isLoading}
      />
    </Modal>
  );
}
