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
   * Modules with no aqa_v2 equivalent (`admin_halqa`, `attendance_punch`)
   * are always `false` — there is nothing in aqa_v2 to derive them from.
   * `own_type` strings are static per-module placeholders copied from the
   * legacy system's own defaults, not derived from any aqa_v2 data — aqa_v2
   * has no equivalent "own vs all" scoping concept to compute them from.
   *
   * teachers/students/lessons/hifdh/halqa/admin_halqa are flattened to a
   * plain boolean (their only surviving action, `view`) rather than an
   * object; leaves only exposes `create`. The other legacy CRUD actions for
   * these modules were dropped by request, not derived from aqa_v2 data.
   */
  buildLegacyPermissions(granted: Set<string>): Record<string, Record<string, boolean | string> | boolean> {
    const has = (key: string) => granted.has(key);

    return {
      teachers: has('hr.teachers.view'),
      students: has('student_management.students.view'),
      attendance: {
        attendance_summary: has('hr.attendance.view'),
        leaves: has('hr.leaves.view'),
        leave_approval: has('hr.leaves.approve'),
        attendance_approval: has('hr.attendance.manage'),
      },
      attendance_punch: { Normal: false, Photo: false, Face: false, QR: false },
      leaves: {
        create: has('hr.leaves.apply'),
        own_type: 'own',
      },
      halqa: has('academic.halqas.view'),
      admin_halqa: false,
      lessons: has('academic.lessons.view'),
      hifdh: has('academic.hifdh_schedules.view') || has('academic.hifdh_progress.view'),
    };
  }
}
