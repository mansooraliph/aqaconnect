import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { MobileAttendanceService } from './attendance.service';
import { RejectAttendanceDto } from './dto/reject-attendance.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

function requireDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  if (!startDate || !endDate) {
    throw new BadRequestException('start_date and end_date are required');
  }
  return { start: new Date(startDate), end: new Date(endDate) };
}

@Controller('app')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.attendance.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class AttendanceController {
  constructor(
    private readonly service: MobileAttendanceService,
    private readonly context: MobileContextService,
  ) {}

  @Get('attendance-summary')
  async attendanceSummary(
    @Req() req: AuthedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    if (!year || !month) {
      throw new BadRequestException('year and month are required');
    }
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const { summary, dailyReport } = await this.service.ownSummary(branchId, req.user.userId, Number(year), Number(month));
    return { ...summary, dailyReport };
  }

  @Get('employees-attendance-summery')
  async employeesAttendanceSummary(
    @Req() req: AuthedRequest,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const { start, end } = requireDateRange(startDate, endDate);
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const result = await this.service.allEmployeesSummary(branchId, start, end);
    return { status: 'success', dateRange: { startDate, endDate }, ...result };
  }

  @Get('attendance/employee/:employeeId/report')
  async employeeReport(
    @Req() req: AuthedRequest,
    @Param('employeeId') employeeId: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const { start, end } = requireDateRange(startDate, endDate);
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const result = await this.service.employeeReport(branchId, employeeId, start, end);
    return { status: 'success', dateRange: { startDate, endDate }, ...result };
  }

  @Get('attendance/not-approved')
  async notApproved(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const data = await this.service.listNotApproved(branchId);
    return Reply.dataOnly({ error: false, message: '', data });
  }

  @Get('attendance/approved')
  async approved(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const data = await this.service.listApproved(branchId);
    return Reply.dataOnly({ error: false, message: '', data });
  }

  @Post('attendance/approve/:id')
  async approve(@Req() req: AuthedRequest, @Param('id') id: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    await this.service.approve(branchId, id, req.user.userId);
    return Reply.success('Attendance request approved and records saved.');
  }

  @Post('attendance/reject/:id')
  async reject(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: RejectAttendanceDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    await this.service.reject(branchId, id, req.user.userId, dto.rejection_reason);
    return Reply.success('Attendance request rejected successfully');
  }
}
