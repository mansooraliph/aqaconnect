import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from '../../rbac/access-control.service';

/**
 * The legacy mobile API is single-tenant per request: every endpoint scopes
 * its queries to `company()->id` (implicit, resolved from the authenticated
 * session) rather than a URL path segment. The new backend is multi-branch
 * with branchId always explicit in the URL for its modern REST modules —
 * there is no branchId segment on any legacy-shaped mobile route, so we
 * resolve "the caller's branch" the same way the legacy app resolved "the
 * caller's company": from the authenticated user's own Teacher/Student
 * record, or (for branch/global staff) from their role assignment.
 */
@Injectable()
export class MobileContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async resolveBranchId(userId: string): Promise<string> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (teacher) {
      return teacher.branchId;
    }

    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (student) {
      return student.branchId;
    }

    const context = await this.accessControl.getUserAccessContext(userId);
    const roleBranchId = context.roles.find((role) => role.branchId)?.branchId;
    if (roleBranchId) {
      return roleBranchId;
    }
    const [firstAllowed] = context.allowedBranchIds;
    if (firstAllowed) {
      return firstAllowed;
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.branchId) {
      return user.branchId;
    }

    throw new ForbiddenException('Unable to resolve a branch for this user');
  }

  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const context = await this.accessControl.getUserAccessContext(userId);
    return context.roles.some((role) => role.name.toLowerCase() === roleName.toLowerCase());
  }

  /**
   * Legacy student-facing routes accept an optional `{studentId?}` segment,
   * defaulting to `user()->id` (legacy has no separate Student table — a
   * student *is* a User with the "student" role). This schema splits
   * Student out from User, and every student-scoped table is keyed on
   * Student.id, so "no id given" here resolves to the caller's own
   * Student.id via their linked userId, not their raw userId.
   */
  async resolveOwnStudentId(userId: string): Promise<string> {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) {
      throw new ForbiddenException('This account has no linked student profile');
    }
    return student.id;
  }

  /** Legacy: `role_user` join → lowercased role names, e.g. for the "Approved by teacher,admin" audit note. */
  async getRoleNames(userId: string): Promise<string[]> {
    const context = await this.accessControl.getUserAccessContext(userId);
    return context.roles.map((role) => role.name.toLowerCase());
  }
}
