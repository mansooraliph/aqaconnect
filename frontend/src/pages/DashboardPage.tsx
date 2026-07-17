import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';

interface HalqaBreakdownRow {
  halqaId: string;
  halqaName: string;
  studentCount: number;
}

interface SurahLeaderboardRow {
  studentId: string;
  studentName: string;
  completedCount: number;
}

interface AcademicDashboard {
  totalStudents: number;
  activeStudents: number;
  hifdhCompletionSummary: {
    IN_PROGRESS: number;
    COMPLETED: number;
    VERIFIED: number;
  };
  halqaBreakdown: HalqaBreakdownRow[];
  surahLeaderboard: SurahLeaderboardRow[];
}

const halqaColumns: ColumnDef<HalqaBreakdownRow, unknown>[] = [
  { header: 'Halqa', accessorKey: 'halqaName' },
  { header: 'Students', accessorKey: 'studentCount' },
];

const leaderboardColumns: ColumnDef<SurahLeaderboardRow, unknown>[] = [
  {
    header: 'Rank',
    id: 'rank',
    cell: ({ row }) => row.index + 1,
  },
  { header: 'Student', accessorKey: 'studentName' },
  { header: 'Surahs completed', accessorKey: 'completedCount' },
];

function AcademicKpiSection() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;

  const query = useQuery({
    queryKey: ['academic-dashboard', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicDashboard>(`/branches/${activeBranchId}/academic-dashboard`)).data,
    enabled: Boolean(activeBranchId),
  });

  const data = query.data;

  return (
    <div className="mt-6 rounded-card border border-border bg-white p-5">
      <h2 className="text-base font-semibold text-text-primary">Academic Overview</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total students" value={data?.totalStudents ?? 0} isLoading={query.isLoading} />
        <StatCard title="Active students" value={data?.activeStudents ?? 0} isLoading={query.isLoading} />
        <StatCard
          title="Hifdh in progress"
          value={data?.hifdhCompletionSummary.IN_PROGRESS ?? 0}
          isLoading={query.isLoading}
        />
        <StatCard
          title="Hifdh completed"
          value={data?.hifdhCompletionSummary.COMPLETED ?? 0}
          subtitle={`Verified: ${data?.hifdhCompletionSummary.VERIFIED ?? 0}`}
          isLoading={query.isLoading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-text-primary">Halqa breakdown</h3>
          <DataTable<HalqaBreakdownRow>
            columns={halqaColumns}
            data={data?.halqaBreakdown ?? []}
            isLoading={query.isLoading}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-text-primary">Surah leaderboard (top 10)</h3>
          <DataTable<SurahLeaderboardRow>
            columns={leaderboardColumns}
            data={data?.surahLeaderboard ?? []}
            isLoading={query.isLoading}
          />
        </div>
      </div>
    </div>
  );
}

interface HrDashboard {
  activeEmployees: number;
  activeTeachers: number;
  pendingLeaveRequests: number;
  pendingTeacherApplications: number;
}

function HrKpiSection() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;

  const query = useQuery({
    queryKey: ['hr-dashboard', activeBranchId],
    queryFn: async () =>
      (await api.get<HrDashboard>(`/branches/${activeBranchId}/hr-dashboard`)).data,
    enabled: Boolean(activeBranchId),
  });

  const data = query.data;

  return (
    <div className="mt-6 rounded-card border border-border bg-white p-5">
      <h2 className="text-base font-semibold text-text-primary">HR Overview</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active employees" value={data?.activeEmployees ?? 0} isLoading={query.isLoading} />
        <StatCard title="Active teachers" value={data?.activeTeachers ?? 0} isLoading={query.isLoading} />
        <StatCard
          title="Pending leave requests"
          value={data?.pendingLeaveRequests ?? 0}
          isLoading={query.isLoading}
        />
        <StatCard
          title="Pending teacher applications"
          value={data?.pendingTeacherApplications ?? 0}
          isLoading={query.isLoading}
        />
      </div>
    </div>
  );
}

interface StudentManagementDashboard {
  pendingAdmissions: number;
  totalStudents: number;
  activeStudents: number;
}

function StudentManagementKpiSection() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;

  const query = useQuery({
    queryKey: ['student-management-dashboard', activeBranchId],
    queryFn: async () =>
      (
        await api.get<StudentManagementDashboard>(
          `/branches/${activeBranchId}/student-management-dashboard`,
        )
      ).data,
    enabled: Boolean(activeBranchId),
  });

  const data = query.data;

  return (
    <div className="mt-6 rounded-card border border-border bg-white p-5">
      <h2 className="text-base font-semibold text-text-primary">Student Management Overview</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Pending admissions" value={data?.pendingAdmissions ?? 0} isLoading={query.isLoading} />
        <StatCard title="Total students" value={data?.totalStudents ?? 0} isLoading={query.isLoading} />
        <StatCard title="Active students" value={data?.activeStudents ?? 0} isLoading={query.isLoading} />
      </div>
    </div>
  );
}

interface FeesDashboard {
  totalOutstandingBalance: number;
  recentPaymentsCount: number;
  recentPaymentsAmount: number;
}

function FeesKpiSection() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;

  const query = useQuery({
    queryKey: ['fees-dashboard', activeBranchId],
    queryFn: async () =>
      (await api.get<FeesDashboard>(`/branches/${activeBranchId}/fees-dashboard`)).data,
    enabled: Boolean(activeBranchId),
  });

  const data = query.data;

  return (
    <div className="mt-6 rounded-card border border-border bg-white p-5">
      <h2 className="text-base font-semibold text-text-primary">Fees Overview</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total outstanding balance"
          value={(data?.totalOutstandingBalance ?? 0).toFixed(2)}
          isLoading={query.isLoading}
        />
        <StatCard
          title="Payments (last 30 days)"
          value={data?.recentPaymentsCount ?? 0}
          isLoading={query.isLoading}
        />
        <StatCard
          title="Payment amount (last 30 days)"
          value={(data?.recentPaymentsAmount ?? 0).toFixed(2)}
          isLoading={query.isLoading}
        />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canViewAcademicDashboard = hasPermission('academic.dashboard.view');
  const canViewHrDashboard = hasPermission('hr.employees.view');
  const canViewStudentManagementDashboard = hasPermission('student_management.admissions.view');
  const canViewFeesDashboard = hasPermission('fees.demands.view');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dashboard" variant="plain" />

      <div className="rounded-card border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-text-primary">Phase 2.0 Foundation complete</h2>
        <p className="mt-1 text-sm text-text-muted">
          Auth, RBAC, and branch scoping are live. Functional module screens
          (Configuration, HR, Student Management, Fees, Academic) land in later
          phases.
        </p>

        <dl className="mt-4 max-w-[480px] divide-y divide-border rounded-card border border-border text-sm">
          <div className="flex justify-between gap-4 px-4 py-2">
            <dt className="font-medium text-text-muted">Logged in as</dt>
            <dd className="text-right text-text-primary">
              {user?.firstName} {user?.lastName} ({user?.email})
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-2">
            <dt className="font-medium text-text-muted">Scope</dt>
            <dd className="text-right text-text-primary">
              {user?.isGlobal ? 'Global (all branches)' : 'Branch-scoped'}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-2">
            <dt className="font-medium text-text-muted">Roles</dt>
            <dd className="flex flex-wrap justify-end gap-1">
              {user?.roles.map((r) => (
                <Badge key={r.id}>{r.name}</Badge>
              ))}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-2">
            <dt className="font-medium text-text-muted">Permissions</dt>
            <dd className="flex flex-wrap justify-end gap-1">
              {user?.permissions.map((p) => (
                <Badge key={p} tone="blue">
                  {p}
                </Badge>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      {canViewAcademicDashboard && <AcademicKpiSection />}
      {canViewHrDashboard && <HrKpiSection />}
      {canViewStudentManagementDashboard && <StudentManagementKpiSection />}
      {canViewFeesDashboard && <FeesKpiSection />}
    </div>
  );
}
