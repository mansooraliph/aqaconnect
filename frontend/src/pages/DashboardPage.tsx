import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { MODULES } from '../layout/AppLayout';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils/cn';

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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function WelcomeSection() {
  const user = useAuthStore((s) => s.user);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="rounded-card border border-border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {getGreeting()}, {user?.name?.split(' ')[0]}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{today}</p>
        </div>
        <Badge tone={user?.isGlobal ? 'blue' : 'gray'}>
          {user?.isGlobal ? 'Global scope · all branches' : 'Branch-scoped'}
        </Badge>
      </div>
    </div>
  );
}

function QuickLinksSection() {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const links = useMemo(
    () =>
      MODULES.map((m) => ({ ...m, items: m.items.filter((i) => hasPermission(i.permission)) })).filter(
        (m) => m.items.length > 0,
      ),
    [hasPermission],
  );

  if (links.length === 0) return null;

  return (
    <div className="mt-6 rounded-card border border-border bg-white p-5">
      <h2 className="text-base font-semibold text-text-primary">Quick links</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              onClick={() => navigate(m.items[0].key)}
              className={cn(
                'flex items-center gap-3 rounded-card border border-border p-4 text-left transition-colors',
                'hover:border-brand/40 hover:bg-brand/5',
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-table-head text-text-muted">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text-primary">{m.label}</span>
                <span className="block truncate text-xs text-text-muted">{m.items.length} section{m.items.length === 1 ? '' : 's'}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-faint" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canViewAcademicDashboard = hasPermission('academic.dashboard.view');
  const canViewHrDashboard = hasPermission('hr.employees.view');
  const canViewStudentManagementDashboard = hasPermission('student_management.admissions.view');
  const canViewFeesDashboard = hasPermission('fees.demands.view');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dashboard" variant="plain" />

      <WelcomeSection />
      <QuickLinksSection />

      {canViewAcademicDashboard && <AcademicKpiSection />}
      {canViewHrDashboard && <HrKpiSection />}
      {canViewStudentManagementDashboard && <StudentManagementKpiSection />}
      {canViewFeesDashboard && <FeesKpiSection />}
    </div>
  );
}
