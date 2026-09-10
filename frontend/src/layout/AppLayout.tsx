import { useMemo, useRef, useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  Settings,
  UsersRound,
  GraduationCap,
  DollarSign,
  BookOpen,
  Smartphone,
  Fingerprint,
  ChevronLeft,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useBranches } from '../hooks/useBranches';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { cn } from '../lib/utils/cn';

export interface NavItem {
  key: string;
  label: string;
  permission: string;
}

function initials(name: string | undefined): string {
  if (!name) return '';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export interface ModuleDef {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: NavItem[];
}

export const MODULES: ModuleDef[] = [
  {
    key: 'configuration',
    label: 'Configuration',
    icon: Settings,
    items: [
      { key: '/configuration/academic-years', label: 'Academic Years', permission: 'configuration.academic_years.view' },
      { key: '/configuration/academic-classes', label: 'Academic Classes', permission: 'configuration.academic_classes.view' },
      { key: '/configuration/academic-sections', label: 'Academic Sections', permission: 'configuration.academic_sections.view' },
      { key: '/configuration/class-sections', label: 'Class Sections', permission: 'configuration.class_sections.view' },
      { key: '/configuration/class-section-years', label: 'Class Section Years', permission: 'configuration.class_section_years.view' },
      { key: '/configuration/lesson-stages', label: 'Lesson Stages', permission: 'configuration.lesson_stages.view' },
      { key: '/configuration/surahs', label: 'Surahs', permission: 'configuration.surahs.view' },
      {
        key: '/configuration/surah-ayah-page-lines',
        label: 'Surah Ayah Page Lines',
        permission: 'configuration.surahs.view',
      },
      { key: '/configuration/target-schedules', label: 'Target Schedules', permission: 'configuration.target_schedules.view' },
      { key: '/configuration/calendar', label: 'Calendar', permission: 'configuration.calendar.view' },
      { key: '/configuration/settings', label: 'Branch Settings', permission: 'configuration.branch_settings.view' },
    ],
  },
  {
    key: 'hr',
    label: 'HR',
    icon: UsersRound,
    items: [
      { key: '/hr/departments', label: 'Departments & Designations', permission: 'hr.departments.view' },
      { key: '/hr/employees', label: 'Employees', permission: 'hr.employees.view' },
      { key: '/hr/teachers', label: 'Teachers', permission: 'hr.teachers.view' },
      { key: '/hr/leaves', label: 'Leaves & Quotas', permission: 'hr.leaves.view' },
      { key: '/hr/leave-types', label: 'Leave Types', permission: 'hr.leave_types.view' },
      { key: '/hr/attendance', label: 'Attendance', permission: 'hr.attendance.view' },
      { key: '/hr/holidays', label: 'Holidays', permission: 'hr.holidays.view' },
      { key: '/hr/recognition', label: 'Appreciations & Awards', permission: 'hr.appreciations.view' },
      { key: '/hr/teacher-applications', label: 'Teacher Applications', permission: 'hr.teacher_applications.view' },
    ],
  },
  {
    key: 'student-management',
    label: 'Student Management',
    icon: GraduationCap,
    items: [
      { key: '/student-management/admissions', label: 'Admissions', permission: 'student_management.admissions.view' },
      { key: '/student-management/students', label: 'Students', permission: 'student_management.students.view' },
      { key: '/student-management/enrollments', label: 'Enrollments', permission: 'student_management.enrollments.view' },
      { key: '/student-management/leaves', label: 'Student Leaves', permission: 'student_management.student_leaves.view' },
    ],
  },
  {
    key: 'fees',
    label: 'Fees',
    icon: DollarSign,
    items: [
      { key: '/fees/fee-types', label: 'Fee Types', permission: 'fees.fee_types.view' },
      { key: '/fees/fee-structures', label: 'Fee Structures', permission: 'fees.structures.view' },
      { key: '/fees/student-ledger', label: 'Student Fee Ledger', permission: 'fees.demands.view' },
    ],
  },
  {
    key: 'academic',
    label: 'Academic',
    icon: BookOpen,
    items: [
      { key: '/academic/lessons', label: 'Lessons', permission: 'academic.lessons.view' },
      { key: '/academic/lessons-progress', label: 'Track Progress', permission: 'academic.lesson_progress.view' },
      { key: '/academic/halqas', label: 'Halqas', permission: 'academic.halqas.view' },
      { key: '/academic/hifdh-tracking', label: 'Hifdh Tracking', permission: 'academic.hifdh_schedules.view' },
      { key: '/academic/exams', label: 'Exams', permission: 'academic.exam_types.view' },
      { key: '/academic/current-classes', label: 'Current Classes', permission: 'academic.current_classes.view' },
    ],
  },
  {
    key: 'mobile',
    label: 'Mobile API',
    icon: Smartphone,
    items: [
      { key: '/mobile/permissions', label: 'Permissions', permission: 'system.mobile_api.view' },
      { key: '/mobile/api-docs', label: 'API Documentation', permission: 'system.mobile_api.view' },
      { key: '/mobile/usage-history', label: 'Usage History', permission: 'system.mobile_api.view' },
    ],
  },
  {
    key: 'devices',
    label: 'Devices',
    icon: Fingerprint,
    items: [
      { key: '/devices/biometric-devices', label: 'Biometric Devices', permission: 'devices.biometric_devices.view' },
      { key: '/devices/biometric-enrollments', label: 'Enrollments', permission: 'devices.biometric_devices.view' },
      { key: '/devices/biometric-transactions', label: 'Attendance Punches', permission: 'devices.biometric_devices.view' },
    ],
  },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const setActiveBranchId = useAuthStore((s) => s.setActiveBranchId);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);

  const { data: branches } = useBranches();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const topLevelItems = useMemo(() => {
    const items: NavItem[] = [{ key: '/dashboard', label: 'Dashboard', permission: '' }];
    if (hasPermission('system.branches.view')) items.push({ key: '/branches', label: 'Branches', permission: 'system.branches.view' });
    if (hasPermission('system.users.view')) items.push({ key: '/users', label: 'Users', permission: 'system.users.view' });
    if (hasPermission('system.rbac.view')) items.push({ key: '/roles', label: 'Roles & Permissions', permission: 'system.rbac.view' });
    return items;
  }, [hasPermission]);

  const topLevelIcons: Record<string, ComponentType<{ className?: string }>> = {
    '/dashboard': LayoutDashboard,
    '/branches': Building2,
    '/users': Users,
    '/roles': ShieldCheck,
  };

  const visibleModules = useMemo(
    () =>
      MODULES.map((m) => ({ ...m, items: m.items.filter((i) => hasPermission(i.permission)) })).filter(
        (m) => m.items.length > 0,
      ),
    [hasPermission],
  );

  const activeModule = visibleModules.find((m) => location.pathname.startsWith(`/${m.key}`));

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refresh_token: refreshToken });
      }
    } finally {
      clear();
      navigate('/login', { replace: true });
    }
  };

  const currentPageLabel =
    topLevelItems.find((i) => i.key === location.pathname)?.label ??
    activeModule?.items.find((i) => i.key === location.pathname)?.label ??
    activeModule?.label ??
    'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-bg-page">
      <aside className="flex h-full w-60 shrink-0 flex-col bg-header text-white">
        <div className="flex h-14 items-center px-4 text-base font-semibold">Academic Portal</div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {!activeModule ? (
            <div className="flex flex-col gap-0.5">
              {topLevelItems.map((item) => {
                const Icon = topLevelIcons[item.key];
                const selected = location.pathname === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={cn(
                      'flex items-center gap-3 rounded-card px-3 py-2 text-left text-sm transition-colors',
                      selected ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    {item.label}
                  </button>
                );
              })}

              {visibleModules.length > 0 && (
                <div className="mt-3 border-t border-white/10 pt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Modules
                </div>
              )}
              {visibleModules.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.key}
                    onClick={() => navigate(m.items[0].key)}
                    className="flex items-center gap-3 rounded-card px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => navigate('/dashboard')}
                className="mb-2 flex items-center gap-2 rounded-card px-3 py-2 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                {activeModule.label}
              </button>
              {activeModule.items.map((item) => {
                const selected = location.pathname === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={cn(
                      'rounded-card px-3 py-2 pl-9 text-left text-sm transition-colors',
                      selected ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 px-1 py-1 text-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
              {initials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-white">{user?.name}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-primary">{currentPageLabel}</span>
          </div>

          <div className="flex items-center gap-4">
            {user?.isGlobal && branches && branches.length > 0 ? (
              <Select
                className="w-56"
                value={activeBranchId ?? ''}
                onChange={(e) => setActiveBranchId(e.target.value || null)}
                placeholder="All branches"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            ) : (
              <span className="text-sm text-text-muted">
                {branches?.find((b) => b.id === activeBranchId)?.name ?? 'Your branch'}
              </span>
            )}

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-card px-2 py-1.5 hover:bg-table-alt"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-light text-xs font-semibold text-blue">
                  {initials(user?.name)}
                </div>
                <span className="text-sm text-text-primary">{user?.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-text-faint" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-card border border-border bg-white shadow-lg">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-text-primary hover:bg-table-alt"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
