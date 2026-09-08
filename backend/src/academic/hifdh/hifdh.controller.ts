import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { HifdhService } from './hifdh.service';
import { GenerateSchedulesDto } from './dto/generate-schedules.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import { BulkRescheduleDto } from './dto/bulk-reschedule.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/hifdh-schedules')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class HifdhSchedulesController {
  constructor(private readonly service: HifdhService) {}

  @Get()
  @RequirePermission('academic.hifdh_schedules.view')
  list(
    @Query('studentId') studentId?: string,
    @Query('surahId') surahId?: string,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('fromDay') fromDay?: string,
    @Query('toDay') toDay?: string,
    @Query('scheduleType') scheduleType?: string,
  ) {
    return this.service.listSchedules(
      studentId,
      surahId,
      status,
      fromDate,
      toDate,
      fromDay,
      toDay,
      scheduleType,
    );
  }

  @Get('progress-summary')
  @RequirePermission('academic.hifdh_progress.view')
  progressSummary(
    @Param('branchId') branchId: string,
    @Query('halqaId') halqaId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.service.getProgressSummary(branchId, halqaId, studentId);
  }

  @Post('generate')
  @RequirePermission('academic.hifdh_schedules.manage')
  async generate(
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateSchedulesDto,
  ) {
    const teacherId = await this.service.resolveOwnTeacherId(user.userId);
    return this.service.generateSchedules(branchId, teacherId, dto);
  }

  @Post(':id/mark-completed')
  @RequirePermission('academic.hifdh_progress.mark')
  markCompleted(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markCompleted(id, user.userId);
  }

  @Post(':id/mark-in-progress')
  @RequirePermission('academic.hifdh_progress.mark')
  markInProgress(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markInProgress(id, user.userId);
  }

  @Post(':id/verify')
  @RequirePermission('academic.hifdh_progress.verify')
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.verifySchedule(id, user.userId);
  }

  @Post(':id/reschedule')
  @RequirePermission('academic.hifdh_schedules.manage')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.service.reschedule(id, dto);
  }

  @Post('bulk-reschedule')
  @RequirePermission('academic.hifdh_schedules.manage')
  bulkReschedule(@Body() dto: BulkRescheduleDto) {
    return this.service.bulkReschedule(dto.studentIds, dto.newStartDate, dto.fromDate);
  }
}

@Controller('branches/:branchId/student-surah-progress')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class StudentSurahProgressController {
  constructor(private readonly service: HifdhService) {}

  @Get()
  @RequirePermission('academic.hifdh_progress.view')
  list(
    @Query('studentId') studentId?: string,
    @Query('surahId') surahId?: string,
    @Query('status') status?: string,
    @Query('orderBy') orderBy?: 'schedule' | 'surah_number',
  ) {
    return this.service.listProgress(studentId, surahId, status, orderBy);
  }

  @Post(':studentId/:surahId/verify')
  @RequirePermission('academic.hifdh_progress.verify')
  verify(
    @Param('studentId') studentId: string,
    @Param('surahId') surahId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.verifySurahProgress(studentId, surahId, user.userId);
  }
}
