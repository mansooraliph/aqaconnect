import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { UpdateMobilePermissionsDto } from './dto/update-mobile-permissions.dto';

const MOBILE_API_MODULE = 'mobile_api';

@Controller()
@UseGuards(PermissionsGuard)
export class RbacController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('roles')
  @RequirePermission('system.rbac.view')
  listRoles() {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @Get('permissions')
  @RequirePermission('system.rbac.view')
  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] });
  }

  /** Read-only view backing the Mobile App API "Permissions" page — scoped to `mobile_api.*`, gated by the mobile-api view permission rather than general RBAC view. */
  @Get('mobile-permissions')
  @RequirePermission('system.mobile_api.view')
  async listMobilePermissions() {
    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        include: { rolePermissions: { include: { permission: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.permission.findMany({
        where: { module: MOBILE_API_MODULE },
        orderBy: { key: 'asc' },
      }),
    ]);

    return {
      permissions,
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        scope: role.scope,
        grantedKeys: role.rolePermissions
          .filter((rp) => rp.permission.module === MOBILE_API_MODULE)
          .map((rp) => rp.permission.key),
      })),
    };
  }

  /** Replaces only this role's `mobile_api.*` grants — every other permission it holds is untouched. */
  @Put('roles/:roleId/mobile-permissions')
  @RequirePermission('system.mobile_api.manage')
  async updateMobilePermissions(@Param('roleId') roleId: string, @Body() dto: UpdateMobilePermissionsDto) {
    await this.prisma.role.findUniqueOrThrow({ where: { id: roleId } });

    const mobilePermissions = await this.prisma.permission.findMany({
      where: { module: MOBILE_API_MODULE },
    });
    const requestedKeys = new Set(dto.permissionKeys);

    await this.prisma.$transaction(async (tx) => {
      for (const permission of mobilePermissions) {
        if (requestedKeys.has(permission.key)) {
          await tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId, permissionId: permission.id } },
            create: { roleId, permissionId: permission.id },
            update: {},
          });
        } else {
          await tx.rolePermission.deleteMany({ where: { roleId, permissionId: permission.id } });
        }
      }
    });

    return this.listMobilePermissions();
  }
}
