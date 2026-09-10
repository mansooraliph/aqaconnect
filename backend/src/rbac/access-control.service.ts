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
   * (module -> { action: boolean, own_type?: string } | boolean), for
   * clients that still expect that structure.
   *
   * Wired from the `mobile_api.*.access` keys — the same permission set
   * managed on the "Mobile App API > Permissions" admin screen
   * (RbacController.listMobilePermissions / updateMobilePermissions) —
   * rather than the general RBAC keys, so toggling a role's mobile module
   * access there is the one place that controls what this block reports.
   *
   * Every `mobile_api.*.access` module is represented here, including ones
   * with no legacy-named counterpart (academic_classes, student_leaves,
   * student_surah_progress, surah_schedules, dashboard, profile,
   * hr_lookups, notifications, announcements) — added so nothing grantable
   * on that admin screen is silently missing from this response.
   *
   * `attendance_punch` has no `mobile_api.*` equivalent and stays
   * hardcoded `false` — nothing to derive it from.
   */
  buildLegacyPermissions(granted: Set<string>): Record<string, Record<string, boolean | string> | boolean> {
    const has = (key: string) => granted.has(key);

    return {
      teachers: has('mobile_api.teachers.access'),
      students: has('mobile_api.students.access'),
      halqa: has('mobile_api.halqas.access'),
      admin_halqa: has('mobile_api.admin_halqa.access'),
      lessons: has('mobile_api.lesson_content.access'),
      hifdh: has('mobile_api.surah_schedules.access') || has('mobile_api.student_surah_progress.access'),
      academic_classes: has('mobile_api.academic_classes.access'),
      student_leaves: has('mobile_api.student_leaves.access'),
      student_leave_approval: has('mobile_api.student_leaves.approve'),
      student_surah_progress: has('mobile_api.student_surah_progress.access'),
      surah_schedules: has('mobile_api.surah_schedules.access'),
      dashboard: has('mobile_api.dashboard.access'),
      profile: has('mobile_api.profile.access'),
      hr_lookups: has('mobile_api.hr_lookups.access'),
      notifications: has('mobile_api.notifications.access'),
      announcements: has('mobile_api.announcements.access'),
      attendance: {
        attendance_summary: has('mobile_api.attendance.access'),
        leave_approval: has('mobile_api.leaves.access'),
        attendance_approval: has('mobile_api.attendance.access'),
      },
      attendance_punch: { Normal: false, Photo: false, Face: false, QR: false },
    };
  }
}
