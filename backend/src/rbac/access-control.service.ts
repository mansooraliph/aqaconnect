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
}
