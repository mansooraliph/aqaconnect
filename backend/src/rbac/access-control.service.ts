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

  private static readonly ADMIN_ROLE_NAMES = ['Super Admin', 'Branch Admin', 'Management'];

  /** Mirrors the frontend's RoleTier (apiCatalog.ts) — anything not admin-tier or literally "Student" is 'teacher'. */
  private roleTier(roles: { name: string }[]): 'admin' | 'teacher' | 'student' {
    if (roles.some((r) => AccessControlService.ADMIN_ROLE_NAMES.includes(r.name))) return 'admin';
    if (roles.some((r) => r.name === 'Student')) return 'student';
    return 'teacher';
  }

  /**
   * Builds the mobile permission shape, GROUPED BY APP TAB (dashboard/
   * lessons/halqa/hifdh/attendance/profile) rather than one flat object,
   * and SCOPED TO THE CALLER'S ROLE TIER — strictly mirrors the checkboxes
   * the "Mobile App API > Permissions" admin screen shows for that same
   * tier (apiCatalog.ts's `tiers` field): only fields with a matching
   * checkbox for this tier are included, so e.g. an admin's `dashboard`
   * never carries Student-only fields like `header`/`my_progress`, and a
   * Student's response has no `halqa` group at all (they get `hifdh`
   * instead). `mark_attendance`/`student_summary` render as disabled
   * placeholders on that screen (no backend capability yet) and stay
   * hardcoded `false` here to match.
   *
   * This is a breaking response-shape change coordinated with an
   * in-progress mobile app update to read permissions.<tab>.<field>.
   */
  buildLegacyPermissions(context: UserAccessContext): Record<string, Record<string, boolean>> {
    const has = (key: string) => context.permissions.has(key);
    const tier = this.roleTier(context.roles);

    const dashboard: Record<string, boolean> =
      tier === 'student'
        ? {
            header: has('mobile_api.dashboard.header'),
            verse_of_day: has('mobile_api.dashboard.verse_of_day'),
            my_progress: has('mobile_api.student_surah_progress.access'),
            my_learning: has('mobile_api.lesson_content.access'),
            my_schedule: has('mobile_api.surah_schedules.access'),
            apply_leave: has('mobile_api.student_leaves.access'),
            announcements: has('mobile_api.dashboard.announcements'),
          }
        : {
            summary_card: has('mobile_api.dashboard.access'),
            todays_progress: has('mobile_api.student_surah_progress.access'),
            manage_students_activity: has('mobile_api.students.activity.access'),
            student_reports: has('mobile_api.students.reports.access'),
            assign_students_to_halqa: has('mobile_api.halqas.access'),
            announcements: has('mobile_api.announcements.access'),
            ...(tier === 'admin'
              ? {
                  students: has('mobile_api.students.access'),
                  teachers: has('mobile_api.teachers.access'),
                  classes: has('mobile_api.academic_classes.access'),
                }
              : {}),
          };

    const attendance: Record<string, boolean> =
      tier === 'student'
        ? { mark_attendance: false }
        : {
            mark_attendance: false,
            student_leave_approvals: has('mobile_api.student_leaves.approve'),
            student_summary: false,
            ...(tier === 'admin'
              ? {
                  employee_attendance: has('mobile_api.attendance.access'),
                  leave_approvals: has('mobile_api.leaves.approve'),
                  attendance_approvals: has('mobile_api.attendance.approve'),
                }
              : {}),
          };

    return {
      dashboard,
      lessons: {
        lesson_stages: has('mobile_api.lesson_content.access'),
        lessons: has('mobile_api.lesson_content.access'),
      },
      ...(tier === 'student'
        ? { hifdh: { hifdh: has('mobile_api.surah_schedules.access') } }
        : {
            halqa: {
              halqa_list: has('mobile_api.halqas.access'),
              add_halqa: has('mobile_api.halqas.create'),
            },
          }),
      attendance,
      profile: {
        edit_profile: has('mobile_api.profile.edit'),
      },
    };
  }
}
