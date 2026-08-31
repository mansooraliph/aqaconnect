import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserAccessContext {
  userId: string;
  isGlobal: boolean;
  permissions: Set<string>;
  /** Branch ids this user may act within. Empty + isGlobal=true means "all branches". */
  allowedBranchIds: Set<string>;
  roles: { id: string; name: string; scope: 'GLOBAL' | 'BRANCH'; branchId: string | null }[];
}

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserAccessContext(userId: string): Promise<UserAccessContext> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: { include: { rolePermissions: { include: { permission: true } } } },
          },
        },
      },
    });

    const permissions = new Set<string>();
    const allowedBranchIds = new Set<string>();
    let isGlobal = false;

    const roles = user.userRoles.map((userRole) => {
      const effectiveBranchId = userRole.branchId ?? user.branchId ?? null;

      if (userRole.role.scope === 'GLOBAL') {
        isGlobal = true;
      } else if (effectiveBranchId) {
        allowedBranchIds.add(effectiveBranchId);
      }

      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.key);
      }

      return {
        id: userRole.role.id,
        name: userRole.role.name,
        scope: userRole.role.scope,
        branchId: effectiveBranchId,
      };
    });

    return { userId, isGlobal, permissions, allowedBranchIds, roles };
  }

  /** True if the given branchId is one this user is allowed to act within. */
  canAccessBranch(context: UserAccessContext, branchId: string): boolean {
    return context.isGlobal || context.allowedBranchIds.has(branchId);
  }

  /**
   * Builds the exact legacy source system's per-module permission shape
   * (module -> { action: boolean, own_type?: string }), for clients that
   * still expect that structure. Every module and action from the legacy
   * catalog is always present, `false` unless mapped to a granted aqa_v2
   * permission key below.
   *
   * Modules with no aqa_v2 equivalent (`tasks`, `projects`, `leads`,
   * `schedule`, `proposals`, `clients`, `tickets`, `overtime_requests`,
   * `admin_halqa`, `attendance_punch`, and the `apply_for_ot` action) are
   * always `false` — there is nothing in aqa_v2 to derive them from.
   * `own_type` strings are static per-module placeholders copied from the
   * legacy system's own defaults, not derived from any aqa_v2 data — aqa_v2
   * has no equivalent "own vs all" scoping concept to compute them from.
   */
  buildLegacyPermissions(granted: Set<string>): Record<string, Record<string, boolean | string>> {
    const has = (key: string) => granted.has(key);

    return {
      tasks: { view: false, own_type: 'all', create: false, edit: false, delete: false, assign: false },
      projects: { view: false, own_type: 'all', create: false, edit: false, delete: false, assign: false },
      leads: { view: false, own_type: '', create: false, edit: false, delete: false, assign: false },
      schedule: { view: false, create: false, edit: false, delete: false },
      proposals: { view: false, own_type: '', create: false, edit: false, delete: false },
      employees: {
        view: has('hr.employees.view'),
        own_type: '',
        create: has('hr.employees.manage'),
        edit: has('hr.employees.manage'),
        delete: has('hr.employees.manage'),
      },
      clients: { view: false, own_type: '', create: false, edit: false, delete: false },
      teachers: {
        create: has('hr.teachers.manage'),
        view: has('hr.teachers.view'),
        own_type: 'all',
        edit: has('hr.teachers.manage'),
        delete: has('hr.teachers.manage'),
      },
      students: {
        create: has('student_management.students.manage'),
        view: has('student_management.students.view'),
        edit: has('student_management.students.manage'),
        delete: has('student_management.students.manage'),
        assign: has('student_management.students.manage'),
        own_type: 'all',
      },
      attendance: {
        attendance_summary: has('hr.attendance.view'),
        leaves: has('hr.leaves.view'),
        apply_for_ot: false,
        leave_approval: has('hr.leaves.approve'),
        attendance_approval: has('hr.attendance.manage'),
      },
      attendance_punch: { Normal: false, Photo: false, Face: false, QR: false },
      tickets: { view: false, own_type: 'all', create: false, edit: false, delete: false },
      leaves: {
        create: has('hr.leaves.apply'),
        view: has('hr.leaves.view'),
        own_type: 'own',
        edit: has('hr.leaves.approve'),
        delete: false,
      },
      overtime_requests: { view: false, own_type: 'all', create: false, edit: false, delete: false },
      halqa: {
        create: has('academic.halqas.manage'),
        view: has('academic.halqas.view'),
        edit: has('academic.halqas.manage'),
        delete: has('academic.halqas.manage'),
        own_type: 'all',
      },
      admin_halqa: { view: false, own_type: 'all', create: false, edit: false, delete: false },
      lessons: {
        create: has('academic.lessons.manage'),
        view: has('academic.lessons.view'),
        edit: has('academic.lessons.manage'),
        delete: has('academic.lessons.manage'),
        own_type: 'all',
      },
      hifdh: {
        view: has('academic.hifdh_schedules.view') || has('academic.hifdh_progress.view'),
        own_type: 'all',
        create: has('academic.hifdh_schedules.manage'),
        edit: has('academic.hifdh_progress.mark'),
        delete: false,
      },
    };
  }
}
