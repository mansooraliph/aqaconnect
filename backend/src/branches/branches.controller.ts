import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../rbac/access-control.service';
import { CalendarDaysService } from '../configuration/calendar-days/calendar-days.service';
import { BulkSetCalendarDaysDto } from '../configuration/calendar-days/dto/bulk-set-calendar-days.dto';
import { BranchSettingsService } from '../configuration/branch-settings/branch-settings.service';
import { BulkSetWeekendDaysDto } from '../configuration/branch-settings/dto/bulk-set-weekend-days.dto';
import { HifdhService } from '../academic/hifdh/hifdh.service';
import { BulkScheduleConflictsDto } from '../academic/hifdh/dto/bulk-schedule-conflicts.dto';

@Controller('branches')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly accessControl: AccessControlService,
    private readonly calendarDaysService: CalendarDaysService,
    private readonly branchSettingsService: BranchSettingsService,
    private readonly hifdhService: HifdhService,
  ) {}

  @Get()
  @RequirePermission('system.branches.view')
  async list(@CurrentUser() user: AuthenticatedUser) {
    const accessContext = await this.accessControl.getUserAccessContext(user.userId);
    return this.branchesService.listForUser(accessContext);
  }

  // Two path segments so these never collide with the single-segment
  // PATCH /:branchId route below, regardless of declaration order.
  @Patch('bulk/weekend-days')
  @RequirePermission('master_calendar.manage')
  bulkSetWeekendDays(@Body() dto: BulkSetWeekendDaysDto) {
    return this.branchSettingsService.bulkSetWeekendDays(dto.branchIds, dto.weekendDays);
  }

  @Patch('bulk/calendar-days')
  @RequirePermission('master_calendar.manage')
  bulkSetCalendarDays(@Body() dto: BulkSetCalendarDaysDto) {
    return this.calendarDaysService.bulkSetDays(dto);
  }

  @Post('bulk/schedule-conflicts')
  @RequirePermission('academic.hifdh_schedules.view')
  bulkScheduleConflicts(@Body() dto: BulkScheduleConflictsDto) {
    return this.hifdhService.getScheduleConflictsBulk(dto.branchIds, dto.dates);
  }

  @Post()
  @RequirePermission('system.branches.manage')
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Get(':branchId')
  @RequirePermission('system.branches.view')
  findOne(@Param('branchId') branchId: string) {
    return this.branchesService.findOne(branchId);
  }

  @Patch(':branchId')
  @RequirePermission('system.branches.manage')
  update(@Param('branchId') branchId: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(branchId, dto);
  }
}
