import { useState } from 'react';
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
  surahId: string;
  fromAyah: number;
  toAyah: number;
  scheduledDate: string;
  status: HifdhScheduleStatus;
  teacherId: string | null;
  teacher: TeacherRef | null;
  rescheduledFromId: string | null;
  rescheduledFrom: { scheduledDate: string } | null;
  rescheduledTo: { id: string; scheduledDate: string } | null;
  student: { name: string; studentCode: string };
  surah: { number: number; nameEnglish: string };
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
  verifiedBy: { user: { firstName: string; lastName: string } } | null;
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

  const [tab, setTab] = useState<'schedules' | 'progress'>('schedules');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Hifdh Tracking" variant="plain" />
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { key: 'schedules', label: 'Schedules' },
            { key: 'progress', label: 'Progress Summary' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'border-b-2 border-blue px-4 py-2 text-sm font-medium text-blue'
                : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary'
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'schedules' ? (
        <SchedulesTab
          activeBranchId={activeBranchId}
          hasPermission={hasPermission}
          studentOptions={studentOptions}
          studentsLoading={studentsQuery.isLoading}
          surahOptions={surahOptions}
          surahsLoading={surahsQuery.isLoading}
        />
      ) : (
        <ProgressSummaryTab activeBranchId={activeBranchId} hasPermission={hasPermission} />
      )}
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

function StudentMultiSelect({
  options,
  value,
  onChange,
  loading,
}: {
  options: SelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  loading?: boolean;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="flex w-80 flex-col gap-1">
      <span className="text-xs font-medium text-text-muted">
        Students {value.length > 0 && `(${value.length} selected)`}
      </span>
      <div className="max-h-40 overflow-y-auto rounded-card border border-border bg-white p-2">
        {loading ? (
          <p className="p-2 text-sm text-text-faint">Loading…</p>
        ) : options.length === 0 ? (
          <p className="p-2 text-sm text-text-faint">No students found</p>
        ) : (
          options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-table-alt">
              <Checkbox checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
              <span className="text-sm text-text-primary">{o.label}</span>
            </label>
          ))
        )}
      </div>
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
  const canView = hasPermission('academic.hifdh_schedules.view');
  const canMark = hasPermission('academic.hifdh_progress.mark');
  const canVerify = hasPermission('academic.hifdh_progress.verify');

  // ---- Generate panel ----
  const [genStudentIds, setGenStudentIds] = useState<string[]>([]);
  const [genStartDate, setGenStartDate] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // ---- Filters ----
  const [filterStudentId, setFilterStudentId] = useState<string>('');
  const [filterSurahId, setFilterSurahId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const scheduleQueryKey = [
    'hifdh-schedules',
    activeBranchId,
    filterStudentId,
    filterSurahId,
    filterStatus,
  ];

  const schedulesQuery = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: async () =>
      (
        await api.get<HifdhSchedule[]>(`/branches/${activeBranchId}/hifdh-schedules`, {
          params: {
            studentId: filterStudentId || undefined,
            surahId: filterSurahId || undefined,
            status: filterStatus || undefined,
          },
        })
      ).data,
    enabled: Boolean(activeBranchId && canView),
  });

  const refetchSchedules = () => queryClient.invalidateQueries({ queryKey: ['hifdh-schedules'] });

  const runGenerate = async () => {
    if (genStudentIds.length === 0 || !genStartDate) {
      toast.error('Select students and a start date');
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post<{ created: number; items: unknown[] }>(
        `/branches/${activeBranchId}/hifdh-schedules/generate`,
        {
          studentIds: genStudentIds,
          startDate: genStartDate,
        },
      );
      toast.success(`Generated ${data.created} schedule${data.created === 1 ? '' : 's'}`);
      refetchSchedules();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to generate schedules'));
    } finally {
      setGenerating(false);
    }
  };

  const markCompletedMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/branches/${activeBranchId}/hifdh-schedules/${id}/mark-completed`)).data,
    onSuccess: () => {
      toast.success('Marked as completed');
      refetchSchedules();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to mark as completed')),
  });

  const markInProgressMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/branches/${activeBranchId}/hifdh-schedules/${id}/mark-in-progress`)).data,
    onSuccess: () => {
      toast.success('Reverted to in progress');
      refetchSchedules();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to revert')),
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/branches/${activeBranchId}/hifdh-schedules/${id}/verify`)).data,
    onSuccess: () => {
      toast.success('Verified');
      refetchSchedules();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to verify')),
  });

  // ---- Reschedule modal ----
  const [rescheduleTarget, setRescheduleTarget] = useState<HifdhSchedule | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const openReschedule = (record: HifdhSchedule) => {
    setRescheduleTarget(record);
    setRescheduleDate(record.scheduledDate?.slice(0, 10) ?? '');
  };

  const closeReschedule = () => {
    setRescheduleTarget(null);
    setRescheduleDate('');
  };

  const submitReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate) return;
    setRescheduleLoading(true);
    try {
      await api.post(`/branches/${activeBranchId}/hifdh-schedules/${rescheduleTarget.id}/reschedule`, {
        newDate: rescheduleDate,
      });
      toast.success('Rescheduled — a new schedule row was created, the original is kept for history');
      refetchSchedules();
      closeReschedule();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reschedule'));
    } finally {
      setRescheduleLoading(false);
    }
  };

  const columns: ColumnDef<HifdhSchedule, unknown>[] = [
    {
      header: 'Student',
      cell: ({ row }) =>
        `${row.original.student.name} (${row.original.student.studentCode})`,
    },
    {
      header: 'Surah',
      cell: ({ row }) => `${row.original.surah.number}. ${row.original.surah.nameEnglish}`,
    },
    {
      header: 'Ayahs',
      cell: ({ row }) => `${row.original.fromAyah}-${row.original.toAyah}`,
    },
    {
      header: 'Scheduled date',
      accessorKey: 'scheduledDate',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <span>{record.scheduledDate ? new Date(record.scheduledDate).toLocaleDateString() : '-'}</span>
            {record.rescheduledFrom && (
              <span
                title={`Rescheduled from ${new Date(record.rescheduledFrom.scheduledDate).toLocaleDateString()}`}
              >
                <Badge tone="purple">rescheduled</Badge>
              </span>
            )}
            {record.rescheduledTo && (
              <span
                title={`Superseded by a reschedule to ${new Date(record.rescheduledTo.scheduledDate).toLocaleDateString()}`}
              >
                <Badge tone="gray">superseded</Badge>
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: 'Teacher',
      cell: ({ row }) =>
        row.original.teacher
          ? `${row.original.teacher.user.firstName} ${row.original.teacher.user.lastName}`
          : '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const record = row.original;
        const isDone = record.status === 'COMPLETED';
        return (
          <div className="flex flex-wrap items-center gap-2">
            {canMark && record.status === 'PENDING' && (
              <Button
                size="sm"
                variant="outline"
                loading={markInProgressMutation.isPending}
                onClick={() => markInProgressMutation.mutate(record.id)}
              >
                Start
              </Button>
            )}
            {canMark && record.status === 'IN_PROGRESS' && (
              <Button
                size="sm"
                variant="outline"
                loading={markCompletedMutation.isPending}
                onClick={() => markCompletedMutation.mutate(record.id)}
              >
                Mark completed
              </Button>
            )}
            {canMark && record.status === 'NEEDS_REVIEW' && (
              <Button
                size="sm"
                variant="outline"
                loading={markInProgressMutation.isPending}
                onClick={() => markInProgressMutation.mutate(record.id)}
              >
                Mark in progress
              </Button>
            )}
            {canVerify && record.status === 'NEEDS_REVIEW' && (
              <Button
                size="sm"
                loading={verifyMutation.isPending}
                onClick={() => verifyMutation.mutate(record.id)}
              >
                Verify
              </Button>
            )}
            {canMark && !isDone && (
              <Button size="sm" variant="outline" onClick={() => openReschedule(record)}>
                Reschedule
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      {canManage && (
        <div className="rounded-card border border-border bg-white p-5">
          <h3 className="text-sm font-semibold text-text-primary">Generate schedules</h3>
          <p className="mt-1 text-sm text-text-muted">
            Generates one schedule row per selected student for each day defined in the master
            target schedule, starting from the given date. Re-running with the same inputs skips
            days that already exist.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <StudentMultiSelect
              options={studentOptions}
              value={genStudentIds}
              onChange={setGenStudentIds}
              loading={studentsLoading}
            />
            <Field label="Start date">
              <Input type="date" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} />
            </Field>
            <Button loading={generating} onClick={runGenerate}>
              Generate
            </Button>
          </div>
        </div>
      )}

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
        <Field label="Filter by surah">
          <Select
            placeholder="All surahs"
            value={filterSurahId}
            onChange={(e) => setFilterSurahId(e.target.value)}
            options={[{ label: 'All surahs', value: '' }, ...surahOptions]}
            disabled={surahsLoading}
          />
        </Field>
        <Field label="Filter by status">
          <Select
            placeholder="All statuses"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[{ label: 'All statuses', value: '' }, ...SCHEDULE_STATUS_FILTER_OPTIONS]}
          />
        </Field>
      </div>

      <DataTable<HifdhSchedule>
        columns={columns}
        data={schedulesQuery.data ?? []}
        isLoading={schedulesQuery.isLoading}
      />

      <Modal
        open={Boolean(rescheduleTarget)}
        title="Reschedule"
        onClose={closeReschedule}
        footer={
          <>
            <Button variant="outline" onClick={closeReschedule} disabled={rescheduleLoading}>
              Cancel
            </Button>
            <Button onClick={submitReschedule} loading={rescheduleLoading}>
              OK
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          This creates a new schedule row for the new date. The original row is kept for history
          and will show as superseded once this is submitted.
        </p>
        <div className="mt-4">
          <Field label="New date" required>
            <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function ProgressSummaryTab({
  activeBranchId,
  hasPermission,
}: {
  activeBranchId: string | undefined;
  hasPermission: (key: string) => boolean;
}) {
  const canView = hasPermission('academic.hifdh_progress.view');

  const halqasQuery = useBranchResource<HalqaOption>(activeBranchId, 'halqas').list;
  const halqaOptions = (halqasQuery.data ?? []).map((h) => ({ label: h.name, value: h.id }));

  const [filterHalqaId, setFilterHalqaId] = useState<string>('');

  const summaryQuery = useQuery({
    queryKey: ['hifdh-progress-summary', activeBranchId, filterHalqaId],
    queryFn: async () =>
      (
        await api.get<StudentProgressSummary[]>(
          `/branches/${activeBranchId}/hifdh-schedules/progress-summary`,
          { params: { halqaId: filterHalqaId || undefined } },
        )
      ).data,
    enabled: Boolean(activeBranchId && canView),
  });

  // Which student's detail modal is open, if any — schedule and progress
  // modals are mutually exclusive so only one target is tracked per kind.
  const [scheduleTarget, setScheduleTarget] = useState<StudentProgressSummary | null>(null);
  const [progressTarget, setProgressTarget] = useState<StudentProgressSummary | null>(null);

  const columns: ColumnDef<StudentProgressSummary, unknown>[] = [
    { header: 'Student Name', accessorKey: 'studentName' },
    { header: 'Student ID', accessorKey: 'studentCode' },
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
          <Button size="sm" variant="outline" onClick={() => setScheduleTarget(row.original)}>
            Day-wise Schedule
          </Button>
          <Button size="sm" variant="outline" onClick={() => setProgressTarget(row.original)}>
            Progress by Surah
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
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

      <DataTable<StudentProgressSummary>
        columns={columns}
        data={summaryQuery.data ?? []}
        isLoading={summaryQuery.isLoading}
      />

      <StudentScheduleModal
        activeBranchId={activeBranchId}
        student={scheduleTarget}
        onClose={() => setScheduleTarget(null)}
      />
      <StudentSurahProgressModal
        activeBranchId={activeBranchId}
        student={progressTarget}
        hasPermission={hasPermission}
        onClose={() => setProgressTarget(null)}
      />
    </>
  );
}

/** Right-side, half-width drawer listing one student's full day-wise Hifdh schedule. */
function StudentScheduleModal({
  activeBranchId,
  student,
  onClose,
}: {
  activeBranchId: string | undefined;
  student: StudentProgressSummary | null;
  onClose: () => void;
}) {
  const scheduleQuery = useQuery({
    queryKey: ['hifdh-schedules', activeBranchId, student?.studentId],
    queryFn: async () =>
      (
        await api.get<HifdhSchedule[]>(`/branches/${activeBranchId}/hifdh-schedules`, {
          params: { studentId: student?.studentId },
        })
      ).data,
    enabled: Boolean(activeBranchId && student),
  });

  const columns: ColumnDef<HifdhSchedule, unknown>[] = [
    {
      header: 'Surah',
      cell: ({ row }) => `${row.original.surah.number}. ${row.original.surah.nameEnglish}`,
    },
    {
      header: 'Ayahs',
      cell: ({ row }) => `${row.original.fromAyah}-${row.original.toAyah}`,
    },
    {
      header: 'Scheduled date',
      cell: ({ row }) =>
        row.original.scheduledDate ? new Date(row.original.scheduledDate).toLocaleDateString() : '-',
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
      width="w-1/2"
    >
      <DataTable<HifdhSchedule>
        columns={columns}
        data={scheduleQuery.data ?? []}
        isLoading={scheduleQuery.isLoading}
      />
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
    mutationFn: async (id: string) =>
      (await api.post(`/branches/${activeBranchId}/student-surah-progress/${id}/verify`)).data,
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
          ? `${row.original.verifiedBy.user.firstName} ${row.original.verifiedBy.user.lastName}`
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
            onClick={() => verifyMutation.mutate(row.original.id)}
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
      width="w-1/2"
    >
      <DataTable<StudentSurahProgress>
        columns={columns}
        data={progressQuery.data ?? []}
        isLoading={progressQuery.isLoading}
      />
    </Modal>
  );
}
