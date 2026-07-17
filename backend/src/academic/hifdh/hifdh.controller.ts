import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { HifdhService } from './hifdh.service';
import { GenerateSchedulesDto } from './dto/generate-schedules.dto';
import { RescheduleDto } from './dto/reschedule.dto';
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
  ) {
    return this.service.listSchedules(studentId, surahId, status);
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
  markCompleted(@Param('id') id: string) {
    return this.service.markCompleted(id);
  }

  @Post(':id/mark-in-progress')
  @RequirePermission('academic.hifdh_progress.mark')
  markInProgress(@Param('id') id: string) {
    return this.service.markInProgress(id);
  }

  @Post(':id/verify')
  @RequirePermission('academic.hifdh_progress.verify')
  async verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const teacherId = await this.service.requireOwnTeacherId(user.userId);
    return this.service.verifySchedule(id, teacherId);
  }

  @Post(':id/reschedule')
  @RequirePermission('academic.hifdh_schedules.manage')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.service.reschedule(id, dto);
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
  ) {
    return this.service.listProgress(studentId, surahId, status);
  }

  @Post(':id/verify')
  @RequirePermission('academic.hifdh_progress.verify')
  async verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const teacherId = await this.service.requireOwnTeacherId(user.userId);
    return this.service.verifyProgressDirect(id, teacherId);
  }
}
