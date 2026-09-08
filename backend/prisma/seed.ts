import { PrismaClient, RoleScope } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Permission set. hr.*/student_management.*/fees.*/academic.* keys are added
// as those modules are built in later phases, per MIGRATION_PLAN.md's
// `<module>.<resource>.<action>` convention.
const PERMISSIONS: { key: string; module: string; description: string }[] = [
  { key: 'system.rbac.view', module: 'system', description: 'View roles and permissions' },
  { key: 'system.branches.view', module: 'system', description: 'View branches' },
  { key: 'system.branches.manage', module: 'system', description: 'Create/update branches' },
  { key: 'system.users.view', module: 'system', description: 'View users' },
  { key: 'system.users.manage', module: 'system', description: 'Create users, assign roles' },
  { key: 'system.mobile_api.view', module: 'system', description: 'View Mobile App API documentation and usage logs' },
  { key: 'system.mobile_api.manage', module: 'system', description: 'Grant/revoke which mobile-app-api modules each role may access' },

  // Mobile App API — per-module access for the real /app/* endpoints the mobile client calls.
  { key: 'mobile_api.academic_classes.access', module: 'mobile_api', description: 'Mobile app: create/update academic classes' },
  { key: 'mobile_api.teachers.access', module: 'mobile_api', description: 'Mobile app: teacher account CRUD' },
  { key: 'mobile_api.halqas.access', module: 'mobile_api', description: 'Mobile app: Halqa CRUD, roster, student assignment' },
  { key: 'mobile_api.students.access', module: 'mobile_api', description: 'Mobile app: student profile CRUD, activity reports, exam records' },
  { key: 'mobile_api.student_leaves.access', module: 'mobile_api', description: 'Mobile app: student leave requests' },
  { key: 'mobile_api.student_surah_progress.access', module: 'mobile_api', description: 'Mobile app: per-ayah Surah progress ledger' },
  { key: 'mobile_api.surah_schedules.access', module: 'mobile_api', description: "Mobile app: a student's Hifdh schedule/progress summary" },
  { key: 'mobile_api.dashboard.access', module: 'mobile_api', description: "Mobile app: teacher dashboard summary" },
  { key: 'mobile_api.profile.access', module: 'mobile_api', description: 'Mobile app: own profile' },
  { key: 'mobile_api.lesson_content.access', module: 'mobile_api', description: 'Mobile app: lesson stages/sub-stages/lessons (read-only content)' },
  { key: 'mobile_api.hr_lookups.access', module: 'mobile_api', description: 'Mobile app: departments/designations lookups' },
  { key: 'mobile_api.attendance.access', module: 'mobile_api', description: 'Mobile app: attendance summaries/reports and clock-in approval review' },
  { key: 'mobile_api.leaves.access', module: 'mobile_api', description: 'Mobile app: leave types, apply/cancel/my-leaves, and approvals' },
  { key: 'mobile_api.notifications.access', module: 'mobile_api', description: 'Mobile app: device-token registration and in-app notification inbox' },
  { key: 'mobile_api.announcements.access', module: 'mobile_api', description: 'Mobile app: read-only branch announcements feed' },

  // Communication
  { key: 'communication.announcements.view', module: 'communication', description: 'View announcements' },
  { key: 'communication.announcements.manage', module: 'communication', description: 'Create/delete announcements (fans out a notification to branch students)' },

  // Configuration (Phase 2.1)
  { key: 'configuration.academic_years.view', module: 'configuration', description: 'View academic years' },
  { key: 'configuration.academic_years.manage', module: 'configuration', description: 'Manage academic years' },
  { key: 'configuration.academic_classes.view', module: 'configuration', description: 'View academic classes' },
  { key: 'configuration.academic_classes.manage', module: 'configuration', description: 'Manage academic classes' },
  { key: 'configuration.academic_sections.view', module: 'configuration', description: 'View academic sections' },
  { key: 'configuration.academic_sections.manage', module: 'configuration', description: 'Manage academic sections' },
  { key: 'configuration.class_sections.view', module: 'configuration', description: 'View class sections' },
  { key: 'configuration.class_sections.manage', module: 'configuration', description: 'Manage class sections' },
  { key: 'configuration.class_section_years.view', module: 'configuration', description: 'View class section years' },
  { key: 'configuration.class_section_years.manage', module: 'configuration', description: 'Manage/generate class section years' },
  { key: 'configuration.lesson_stages.view', module: 'configuration', description: 'View lesson stages' },
  { key: 'configuration.lesson_stages.manage', module: 'configuration', description: 'Manage lesson stages' },
  { key: 'configuration.lesson_sub_stages.view', module: 'configuration', description: 'View lesson sub-stages' },
  { key: 'configuration.lesson_sub_stages.manage', module: 'configuration', description: 'Manage lesson sub-stages' },
  { key: 'configuration.surahs.view', module: 'configuration', description: 'View Surah reference data' },
  { key: 'configuration.surahs.manage', module: 'configuration', description: 'Manage Surah reference data' },
  { key: 'configuration.target_schedules.view', module: 'configuration', description: 'View Surah target schedules' },
  { key: 'configuration.target_schedules.manage', module: 'configuration', description: 'Manage Surah target schedules' },
  { key: 'configuration.calendar.view', module: 'configuration', description: 'View branch calendar' },
  { key: 'configuration.calendar.manage', module: 'configuration', description: 'Manage/generate branch calendar' },
  { key: 'configuration.branch_settings.view', module: 'configuration', description: 'View branch settings' },
  { key: 'configuration.branch_settings.manage', module: 'configuration', description: 'Manage branch settings' },

  // HR (Phase 2.2)
  { key: 'hr.departments.view', module: 'hr', description: 'View departments' },
  { key: 'hr.departments.manage', module: 'hr', description: 'Manage departments' },
  { key: 'hr.designations.view', module: 'hr', description: 'View designations' },
  { key: 'hr.designations.manage', module: 'hr', description: 'Manage designations' },
  { key: 'hr.employees.view', module: 'hr', description: 'View employees' },
  { key: 'hr.employees.manage', module: 'hr', description: 'Create/update employees, assign role' },
  { key: 'hr.teachers.view', module: 'hr', description: 'View teachers' },
  { key: 'hr.teachers.manage', module: 'hr', description: 'Create/update teachers' },
  { key: 'hr.leaves.view', module: 'hr', description: 'View leave requests' },
  { key: 'hr.leaves.apply', module: 'hr', description: 'Apply for leave (self-service)' },
  { key: 'hr.leaves.approve', module: 'hr', description: 'Approve/reject leave requests' },
  { key: 'hr.leave_quotas.view', module: 'hr', description: 'View leave quotas' },
  { key: 'hr.leave_quotas.manage', module: 'hr', description: 'Manage leave quotas' },
  { key: 'hr.leave_types.view', module: 'hr', description: 'View leave types' },
  { key: 'hr.leave_types.manage', module: 'hr', description: 'Manage leave types' },
  { key: 'hr.attendance.view', module: 'hr', description: 'View attendance records' },
  { key: 'hr.attendance.manage', module: 'hr', description: 'Mark/edit attendance' },
  { key: 'hr.holidays.view', module: 'hr', description: 'View holidays' },
  { key: 'hr.holidays.manage', module: 'hr', description: 'Manage holidays' },
  { key: 'hr.appreciations.view', module: 'hr', description: 'View appreciations' },
  { key: 'hr.appreciations.create', module: 'hr', description: 'Give an appreciation' },
  { key: 'hr.awards.view', module: 'hr', description: 'View awards' },
  { key: 'hr.awards.create', module: 'hr', description: 'Give an award' },
  { key: 'hr.teacher_applications.view', module: 'hr', description: 'View teacher applications' },
  { key: 'hr.teacher_applications.manage', module: 'hr', description: 'Review/approve/reject teacher applications' },

  // Student Management (Phase 2.3)
  { key: 'student_management.admissions.view', module: 'student_management', description: 'View admissions' },
  { key: 'student_management.admissions.manage', module: 'student_management', description: 'Review/approve/reject admissions' },
  { key: 'student_management.students.view', module: 'student_management', description: 'View students' },
  { key: 'student_management.students.manage', module: 'student_management', description: 'Create/update students' },
  { key: 'student_management.enrollments.view', module: 'student_management', description: 'View enrollments' },
  { key: 'student_management.enrollments.manage', module: 'student_management', description: 'Enroll/transfer/withdraw students' },
  { key: 'student_management.student_leaves.view', module: 'student_management', description: 'View student leave requests' },
  { key: 'student_management.student_leaves.apply', module: 'student_management', description: 'Apply for student leave (self-service or on a student\'s behalf)' },
  { key: 'student_management.student_leaves.approve', module: 'student_management', description: 'Approve/reject student leave requests' },

  // Fees (Phase 2.4)
  { key: 'fees.fee_types.view', module: 'fees', description: 'View fee types' },
  { key: 'fees.fee_types.manage', module: 'fees', description: 'Manage fee types' },
  { key: 'fees.structures.view', module: 'fees', description: 'View fee structures' },
  { key: 'fees.structures.manage', module: 'fees', description: 'Manage fee structures and installments' },
  { key: 'fees.demands.view', module: 'fees', description: 'View fee demands' },
  { key: 'fees.demands.generate', module: 'fees', description: 'Generate fee demands for a structure' },
  { key: 'fees.payments.view', module: 'fees', description: 'View payment history' },
  { key: 'fees.payments.create', module: 'fees', description: 'Record a payment' },
  { key: 'fees.discounts.view', module: 'fees', description: 'View discounts/waivers' },
  { key: 'fees.discounts.create', module: 'fees', description: 'Apply a discount or waiver to a fee demand' },

  // Academic (Phase 2.5)
  { key: 'academic.lessons.view', module: 'academic', description: 'View lessons' },
  { key: 'academic.lessons.manage', module: 'academic', description: 'Manage lessons' },
  { key: 'academic.lesson_progress.view', module: 'academic', description: 'View student lesson progress' },
  { key: 'academic.lesson_progress.mark', module: 'academic', description: 'Mark a student\'s lesson progress' },
  { key: 'academic.lesson_progress.verify', module: 'academic', description: 'Verify a student\'s completed lesson' },
  { key: 'academic.halqas.view', module: 'academic', description: 'View Halqas and rosters' },
  { key: 'academic.halqas.manage', module: 'academic', description: 'Manage Halqas and student roster assignment' },
  { key: 'academic.hifdh_schedules.view', module: 'academic', description: 'View Hifdh schedules' },
  { key: 'academic.hifdh_schedules.manage', module: 'academic', description: 'Generate/reschedule Hifdh schedules' },
  { key: 'academic.hifdh_progress.view', module: 'academic', description: 'View Hifdh/Surah progress' },
  { key: 'academic.hifdh_progress.mark', module: 'academic', description: 'Mark Hifdh/Surah progress' },
  { key: 'academic.hifdh_progress.verify', module: 'academic', description: 'Verify completed Hifdh/Surah progress' },
  { key: 'academic.current_classes.view', module: 'academic', description: 'View current-classes derived report' },
  { key: 'academic.exam_types.view', module: 'academic', description: 'View exam types' },
  { key: 'academic.exam_types.manage', module: 'academic', description: 'Manage exam types' },
  { key: 'academic.exams.view', module: 'academic', description: 'View exams' },
  { key: 'academic.exams.manage', module: 'academic', description: 'Manage exams' },
  { key: 'academic.exam_results.view', module: 'academic', description: 'View student exam results' },
  { key: 'academic.exam_results.enter', module: 'academic', description: 'Enter/edit draft exam results' },
  { key: 'academic.exam_results.publish', module: 'academic', description: 'Publish exam results' },
  { key: 'academic.dashboard.view', module: 'academic', description: 'View Academic dashboard KPIs' },
];

// Role -> permission keys, per MIGRATION_PLAN.md's "RBAC seed data" starting point.
const ROLES: {
  name: string;
  scope: RoleScope;
  description: string;
  permissionKeys: string[];
}[] = [
  {
    name: 'Super Admin',
    scope: RoleScope.GLOBAL,
    description: 'All permissions, all branches, branch CRUD, RBAC management',
    permissionKeys: PERMISSIONS.map((p) => p.key),
  },
  {
    name: 'Management',
    scope: RoleScope.GLOBAL,
    description: 'Cross-branch read + reporting; no RBAC/branch CRUD by default',
    permissionKeys: [
      'system.branches.view',
      'system.users.view',
      'system.mobile_api.view',
      ...PERMISSIONS.filter(
        (p) =>
          ['configuration', 'hr', 'student_management', 'fees', 'academic'].includes(p.module) &&
          p.key.endsWith('.view'),
      ).map((p) => p.key),
    ],
  },
  {
    name: 'Branch Admin',
    scope: RoleScope.BRANCH,
    description: 'Full control within their branch across all 5 modules',
    permissionKeys: [
      'system.branches.view',
      'system.users.view',
      'system.users.manage',
      'system.mobile_api.view',
      'system.mobile_api.manage',
      ...PERMISSIONS.filter((p) =>
        ['configuration', 'hr', 'student_management', 'fees', 'academic', 'mobile_api', 'communication'].includes(
          p.module,
        ),
      ).map((p) => p.key),
    ],
  },
  {
    name: 'Accountant',
    scope: RoleScope.BRANCH,
    description: 'Fees + Admissions scope only',
    permissionKeys: [
      'student_management.admissions.view',
      'student_management.admissions.manage',
      'student_management.students.view',
      ...PERMISSIONS.filter((p) => p.module === 'fees').map((p) => p.key),
    ],
  },
  {
    name: 'Teacher',
    scope: RoleScope.BRANCH,
    description:
      'Own Halqa/classes/students only — permission grants are branch-wide; ' +
      'restricting to a teacher\'s OWN Halqa/students is enforced by row-level ' +
      'checks in the service layer, not by the permission system alone (see ' +
      'MIGRATION_PLAN.md\'s RBAC seed data notes). Not yet implemented for the ' +
      'Academic endpoints below — flagged as a known gap, not silently assumed.',
    permissionKeys: [
      'hr.leaves.apply',
      'hr.attendance.view',
      'student_management.students.view',
      'student_management.enrollments.view',
      'student_management.student_leaves.view',
      'student_management.student_leaves.approve',
      'academic.lessons.view',
      'academic.lesson_progress.view',
      'academic.lesson_progress.mark',
      'academic.lesson_progress.verify',
      'academic.halqas.view',
      'academic.hifdh_schedules.view',
      'academic.hifdh_progress.view',
      'academic.hifdh_progress.mark',
      'academic.hifdh_progress.verify',
      'academic.current_classes.view',
      'academic.exams.view',
      'academic.exam_results.view',
      'academic.exam_results.enter',
      'academic.dashboard.view',
      'mobile_api.halqas.access',
      'mobile_api.students.access',
      'mobile_api.student_leaves.access',
      'mobile_api.student_surah_progress.access',
      'mobile_api.surah_schedules.access',
      'mobile_api.dashboard.access',
      'mobile_api.profile.access',
      'mobile_api.lesson_content.access',
      'mobile_api.attendance.access',
      'mobile_api.leaves.access',
    ],
  },
  {
    name: 'Student',
    scope: RoleScope.BRANCH,
    description:
      'Self-service mobile app access only — auto-assigned when a student login is provisioned. ' +
      'Row-level scoping (a student only ever sees their own data) is enforced by ' +
      'MobileContextService.resolveOwnStudentId, not by this permission set.',
    permissionKeys: [
      'mobile_api.students.access',
      'mobile_api.student_leaves.access',
      'mobile_api.student_surah_progress.access',
      'mobile_api.surah_schedules.access',
      'mobile_api.profile.access',
      'mobile_api.notifications.access',
      'mobile_api.announcements.access',
    ],
  },
];

async function main() {
  console.log('Seeding permissions...');
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { module: permission.module, description: permission.description },
    });
  }

  console.log('Seeding roles...');
  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      create: {
        name: roleDef.name,
        scope: roleDef.scope,
        description: roleDef.description,
        isSystem: true,
      },
      update: { scope: roleDef.scope, description: roleDef.description },
    });

    for (const permissionKey of roleDef.permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  // Backfill: existing student logins predate the "Student" role (it didn't
  // exist yet when they were created) — give them the same auto-assign every
  // new student login gets, so mobile-app-api guard rollout doesn't lock
  // anyone out.
  console.log('Backfilling Student role onto existing student logins...');
  const studentRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Student' } });
  const studentsWithLogin = await prisma.student.findMany({
    where: { userId: { not: null } },
    select: { userId: true },
  });
  for (const { userId } of studentsWithLogin) {
    const existingRole = await prisma.userRole.findFirst({
      where: { userId: userId!, roleId: studentRole.id },
    });
    if (!existingRole) {
      await prisma.userRole.create({ data: { userId: userId!, roleId: studentRole.id } });
    }
  }

  console.log('Seeding sample branch...');
  const branch = await prisma.branch.upsert({
    where: { code: 'MAIN' },
    create: {
      name: 'Main Campus',
      code: 'MAIN',
      settings: { create: {} },
    },
    update: {},
  });

  console.log('Seeding leave types...');
  for (const name of ['Casual Leave', 'Sick Leave', 'Earned Leave']) {
    await prisma.leaveType.upsert({
      where: { branchId_name: { branchId: branch.id, name } },
      create: { branchId: branch.id, name },
      update: {},
    });
  }

  console.log('Seeding Super Admin user...');
  const devEmail = 'admin@example.com';
  const devPassword = 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(devPassword, 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: devEmail },
    create: {
      username: 'admin',
      email: devEmail,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      branchId: branch.id,
    },
    update: {},
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'Super Admin' },
  });

  // GLOBAL role: no branch scoping, so branchId is null here. Find-then-create
  // rather than `upsert` by compound key — see UsersService.assignRole for
  // why Prisma's compound-unique input can't express a null branchId.
  const existingSuperAdminRole = await prisma.userRole.findFirst({
    where: { userId: superAdmin.id, roleId: superAdminRole.id, branchId: null },
  });
  if (!existingSuperAdminRole) {
    await prisma.userRole.create({
      data: { userId: superAdmin.id, roleId: superAdminRole.id },
    });
  }

  console.log('\n─────────────────────────────────────────────');
  console.log('Seed complete. Dev-only Super Admin credentials:');
  console.log(`  email:    ${devEmail}`);
  console.log(`  password: ${devPassword}`);
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
