import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { ClockInDto } from './dto/clock-in.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/attendances')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get()
  @RequirePermission('hr.attendance.view')
  list(
    @Param('branchId') branchId: string,
    @Query('employeeId') employeeId?: string,
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.list(
      branchId,
      employeeId,
      date,
      month !== undefined ? Number(month) : undefined,
      year !== undefined ? Number(year) : undefined,
    );
  }

  @Get('export')
  @RequirePermission('hr.attendance.view')
  async exportCsv(
    @Param('branchId') branchId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('employeeId') employeeId?: string,
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('departmentId') departmentId?: string,
    @Query('designationId') designationId?: string,
  ) {
    const csv = await this.service.exportCsv(
      branchId,
      employeeId,
      date,
      month !== undefined ? Number(month) : undefined,
      year !== undefined ? Number(year) : undefined,
      departmentId,
      designationId,
    );
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="attendance-export.csv"',
    });
    return csv;
  }

  // Self-service only: the caller's own Employee record is resolved
  // server-side from their userId (AttendanceService.resolveOwnEmployeeId) —
  // no employeeId is accepted from the client, closing the gap flagged
  // during this module's initial build (any holder of `.view` could
  // otherwise clock in/out on behalf of anyone).
  @Post('clock-in')
  @RequirePermission('hr.attendance.view')
  clockIn(
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClockInDto,
  ) {
    return this.service.clockIn(branchId, user.userId, dto);
  }

  @Post('clock-out')
  @RequirePermission('hr.attendance.view')
  clockOut(@Param('branchId') branchId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.clockOut(branchId, user.userId);
  }

  @Patch(':id')
  @RequirePermission('hr.attendance.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post('bulk-mark')
  @RequirePermission('hr.attendance.manage')
  bulkMark(@Param('branchId') branchId: string, @Body() dto: BulkMarkAttendanceDto) {
    return this.service.bulkMark(branchId, dto);
  }
}
