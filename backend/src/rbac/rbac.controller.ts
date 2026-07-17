import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

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
}
