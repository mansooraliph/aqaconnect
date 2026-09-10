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
   * Builds the legacy-derived mobile permission shape, GROUPED BY APP TAB
   * (dashboard/schedules/lessons/halqa/attendance/profile, plus an `other`
   * bucket for permissions not tied to a specific tab) rather than one flat
   * object — matches the mobile app's own tab structure so the client can
   * read `permissions.<tab>.<field>` directly instead of flattening this
   * itself. This is a breaking-change reshape of a previously flat
   * response; every leaf field keeps its old name, just relocated under
   * its tab.
   *
   * Wired from the `mobile_api.*` keys — the same permission set managed
   * on the "Mobile App API > Permissions" admin screen
   * (RbacController.listMobilePermissions / updateMobilePermissions) —
   * rather than the general RBAC keys, so toggling a role's mobile module
   * access there is the one place that controls what this block reports.
   *
   * `attendance_punch`, `mark_attendance`, and `student_summary` have no
   * `mobile_api.*` equivalent and stay hardcoded `false` — nothing to
   * derive them from (the last two are unbuilt mobile features).
   */
  buildLegacyPermissions(
    granted: Set<string>,
  ): Record<string, Record<string, boolean | string | Record<string, boolean>>> {
    const has = (key: string) => granted.has(key);

    return {
      dashboard: {
        dashboard: has('mobile_api.dashboard.access'),
        student_surah_progress: has('mobile_api.student_surah_progress.access'),
        students_activity: has('mobile_api.students.activity.access'),
        students_reports: has('mobile_api.students.reports.access'),
        students: has('mobile_api.students.access'),
        teachers: has('mobile_api.teachers.access'),
        academic_classes: has('mobile_api.academic_classes.access'),
        announcements: has('mobile_api.announcements.access'),
      },
      schedules: {
        schedule: has('mobile_api.surah_schedules.access'),
        surah_schedules: has('mobile_api.surah_schedules.access'),
      },
      lessons: {
        lessons: has('mobile_api.lesson_content.access'),
      },
      halqa: {
        halqa: has('mobile_api.halqas.access'),
        halqa_create: has('mobile_api.halqas.create'),
        admin_halqa: has('mobile_api.admin_halqa.access'),
        hifdh: has('mobile_api.surah_schedules.access') || has('mobile_api.student_surah_progress.access'),
      },
      attendance: {
        hasAny: has('mobile_api.tab_attendance.access'),
        mark_attendance: false,
        attendance_summary: has('mobile_api.attendance.access'),
        leave_approval: has('mobile_api.leaves.approve'),
        student_leave_approval: has('mobile_api.student_leaves.approve'),
        attendance_approval: has('mobile_api.attendance.approve'),
        student_summary: false,
        attendance_punch: { Normal: false, Photo: false, Face: false, QR: false },
      },
      profile: {
        profile: has('mobile_api.profile.access'),
        profile_edit: has('mobile_api.profile.edit'),
      },
      other: {
        student_leaves: has('mobile_api.student_leaves.access'),
        hr_lookups: has('mobile_api.hr_lookups.access'),
        notifications: has('mobile_api.notifications.access'),
      },
    };
  }
}
