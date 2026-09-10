import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { BiometricDevicesService } from './biometric-devices.service';
import { ListEnrollmentsQueryDto, ListTransactionsQueryDto, UpdateAliasDto } from './dto/biometric-query.dto';
import {
  BulkDeviceActionDto,
  BulkEnrollDto,
  BulkSetDuplicatePunchDto,
  EnrollRemotelyDto,
  EnrollUserDto,
  ListEnrollUsersQueryDto,
  RunCommandDto,
  SetDuplicatePunchDto,
  UpdateDeviceSettingsDto,
} from './dto/device-actions.dto';

const VIEW = 'devices.biometric_devices.view';
const MANAGE = 'devices.biometric_devices.manage';

@Controller('branches/:branchId/biometric-devices')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class BiometricDevicesController {
  constructor(private readonly svc: BiometricDevicesService) {}

  @Get()
  @RequirePermission(VIEW)
  list(@Param('branchId') branchId: string) {
    return this.svc.listDevices(branchId);
  }

  @Get('transactions')
  @RequirePermission(VIEW)
  transactions(@Param('branchId') branchId: string, @Query() q: ListTransactionsQueryDto) {
    return this.svc.transactions(branchId, q);
  }

  @Get('enrollments')
  @RequirePermission(VIEW)
  enrollments(@Param('branchId') branchId: string, @Query() q: ListEnrollmentsQueryDto) {
    return this.svc.enrollments(branchId, q);
  }

  @Get('enroll/users')
  @RequirePermission(MANAGE)
  enrollableUsers(@Param('branchId') branchId: string, @Query() q: ListEnrollUsersQueryDto) {
    return this.svc.listEnrollableUsers(branchId, q.type, q.search);
  }

  @Get('settings')
  @RequirePermission(VIEW)
  getSettings(@Param('branchId') branchId: string) {
    return this.svc.getDeviceSettings(branchId);
  }

  @Put('settings')
  @RequirePermission(MANAGE)
  updateSettings(@Param('branchId') branchId: string, @Body() dto: UpdateDeviceSettingsDto) {
    return this.svc.updateDeviceSettings(branchId, dto.prefixes);
  }

  @Get('stats')
  @RequirePermission(VIEW)
  stats(@Param('branchId') branchId: string) {
    return this.svc.stats(branchId);
  }

  @Get(':id')
  @RequirePermission(VIEW)
  get(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.svc.findDevice(branchId, id);
  }

  @Get(':id/commands')
  @RequirePermission(VIEW)
  commands(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.svc.deviceCommands(branchId, id);
  }

  @Patch(':id/alias')
  @RequirePermission(MANAGE)
  rename(@Param('branchId') branchId: string, @Param('id') id: string, @Body() dto: UpdateAliasDto) {
    return this.svc.updateAlias(branchId, id, dto.alias);
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────
  // NOTE: these literal `bulk/*` routes are declared BEFORE the `:id/*` routes
  // so Express does not match `/bulk/...` as `:id = "bulk"`.

  @Post('bulk/restart')
  @RequirePermission(MANAGE)
  bulkRestart(@Param('branchId') branchId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: BulkDeviceActionDto) {
    return this.svc.bulkRestart(dto.deviceIds, branchId, user.userId);
  }

  @Post('bulk/read-info')
  @RequirePermission(MANAGE)
  bulkReadInfo(@Param('branchId') branchId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: BulkDeviceActionDto) {
    return this.svc.bulkReadInfo(dto.deviceIds, branchId, user.userId);
  }

  @Post('bulk/set-duplicate-punch')
  @RequirePermission(MANAGE)
  bulkSetDuplicatePunch(
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkSetDuplicatePunchDto,
  ) {
    return this.svc.bulkSetDuplicatePunch(dto.deviceIds, branchId, dto.seconds, user.userId);
  }

  @Post('bulk/enroll')
  @RequirePermission(MANAGE)
  bulkEnroll(@Param('branchId') branchId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: BulkEnrollDto) {
    return this.svc.bulkEnrollRemotely(dto.deviceIds, branchId, dto, user.userId);
  }

  @Post('enrollments')
  @RequirePermission(MANAGE)
  enrollUser(@Param('branchId') branchId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: EnrollUserDto) {
    return this.svc.enrollUser(branchId, dto, user.userId);
  }

  @Post(':id/restart')
  @RequirePermission(MANAGE)
  restart(@Param('branchId') branchId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.restartDevice(branchId, id, user.userId);
  }

  @Post(':id/read-info')
  @RequirePermission(MANAGE)
  readInfo(@Param('branchId') branchId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.readDeviceInfo(branchId, id, user.userId);
  }

  @Post(':id/set-duplicate-punch')
  @RequirePermission(MANAGE)
  setDuplicatePunch(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetDuplicatePunchDto,
  ) {
    return this.svc.setDuplicatePunch(branchId, id, dto.seconds, user.userId);
  }

  @Post(':id/enroll')
  @RequirePermission(MANAGE)
  enroll(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnrollRemotelyDto,
  ) {
    return this.svc.enrollRemotely(branchId, id, dto, user.userId);
  }

  @Post(':id/clear-commands')
  @RequirePermission(MANAGE)
  clearCommands(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.svc.clearPendingCommands(branchId, id);
  }

  @Post(':id/command')
  @RequirePermission(MANAGE)
  runCommand(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RunCommandDto,
  ) {
    return this.svc.runManualCommand(branchId, id, dto.command, user.userId);
  }

  @Post(':id/sync-users')
  @RequirePermission(MANAGE)
  syncUsers(@Param('branchId') branchId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.syncUsers(branchId, id, user.userId);
  }

  @Post(':id/clear-data')
  @RequirePermission(MANAGE)
  clearData(@Param('branchId') branchId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.clearData(branchId, id, user.userId);
  }

  @Delete('transactions/:id')
  @RequirePermission(MANAGE)
  deleteTransaction(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.svc.deleteTransaction(branchId, id);
  }
}
