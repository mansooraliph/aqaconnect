import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../rbac/access-control.service';
import { BiometricDevicesAdminService } from './biometric-devices-admin.service';
import {
  AssignDeviceDto,
  BulkDeviceActionDto,
  DeactivateDeviceDto,
  ListCommandsQueryDto,
  ListDevicesQueryDto,
} from './dto/biometric-device-admin.dto';

const VIEW = 'devices.biometric_devices.view';
const MANAGE = 'devices.biometric_devices.manage';

/**
 * Device-pool management, not scoped to one branch (a device is unassigned —
 * branchId null — until claimed). BranchScopeGuard still applies so `assign`,
 * which targets a specific branchId in its body, is checked like any other
 * branch-targeting write. Every other mutation targets a device by id, not a
 * branchId, so the service itself re-derives and checks branch ownership for
 * non-global callers (see BiometricDevicesAdminService.assertCanActOn).
 */
@Controller('biometric-devices')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class BiometricDevicesAdminController {
  constructor(
    private readonly svc: BiometricDevicesAdminService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  @RequirePermission(VIEW)
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: ListDevicesQueryDto) {
    return this.svc.list(q, await this.accessControl.getUserAccessContext(user.userId));
  }

  @Get('unassigned')
  @RequirePermission(VIEW)
  unassigned() {
    return this.svc.unassigned();
  }

  @Get('commands')
  @RequirePermission(VIEW)
  commands(@Query() q: ListCommandsQueryDto) {
    return this.svc.listCommands(q);
  }

  @Get(':id')
  @RequirePermission(VIEW)
  get(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/commands')
  @RequirePermission(VIEW)
  deviceCommands(@Param('id') id: string) {
    return this.svc.deviceCommands(id);
  }

  @Patch(':id/assign')
  @RequirePermission(MANAGE)
  assign(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: AssignDeviceDto) {
    return this.svc.assignToBranch(id, dto.branchId, user.userId);
  }

  @Patch(':id/unassign')
  @RequirePermission(MANAGE)
  async unassign(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.unassign(id, await this.accessControl.getUserAccessContext(user.userId));
  }

  @Patch(':id/approve')
  @RequirePermission(MANAGE)
  async approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.approve(id, user.userId, await this.accessControl.getUserAccessContext(user.userId));
  }

  @Patch(':id/deactivate')
  @RequirePermission(MANAGE)
  async deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: DeactivateDeviceDto) {
    return this.svc.deactivate(id, user.userId, dto.reason, await this.accessControl.getUserAccessContext(user.userId));
  }

  @Patch(':id/reactivate')
  @RequirePermission(MANAGE)
  async reactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.reactivate(id, await this.accessControl.getUserAccessContext(user.userId));
  }

  // Literal `bulk/*` routes declared before `:id/*` so `/bulk/...` is not
  // matched as `:id = "bulk"`.
  @Post('bulk/restart')
  @RequirePermission(MANAGE)
  async bulkRestart(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkDeviceActionDto) {
    return this.svc.bulkRestart(dto.deviceIds, user.userId, await this.accessControl.getUserAccessContext(user.userId));
  }

  @Post('bulk/read-info')
  @RequirePermission(MANAGE)
  async bulkReadInfo(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkDeviceActionDto) {
    return this.svc.bulkReadInfo(dto.deviceIds, user.userId, await this.accessControl.getUserAccessContext(user.userId));
  }

  @Post(':id/restart')
  @RequirePermission(MANAGE)
  async restart(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.queueRestart(id, user.userId, await this.accessControl.getUserAccessContext(user.userId));
  }

  @Post(':id/read-info')
  @RequirePermission(MANAGE)
  async readInfo(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.readInfo(id, user.userId, await this.accessControl.getUserAccessContext(user.userId));
  }

  @Post(':id/sync')
  @RequirePermission(MANAGE)
  async sync(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.queueSync(id, user.userId, await this.accessControl.getUserAccessContext(user.userId));
  }

  @Delete(':id')
  @RequirePermission(MANAGE)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.remove(id, await this.accessControl.getUserAccessContext(user.userId));
  }
}
