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

/** The mobile client sends dd-MM-yyyy — JS's native `Date` string constructor would
 *  otherwise silently misread that as MM-DD-YYYY (US-style), so parse explicitly. */
function parseDdMmYyyy(value: string, fieldName: string): Date {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) {
    throw new BadRequestException(`${fieldName} must be in dd-MM-yyyy format`);
  }
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isValid =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
  if (!isValid) {
    throw new BadRequestException(`${fieldName} is not a valid date`);
  }
  return date;
}

function requireDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  if (!startDate || !endDate) {
    throw new BadRequestException('start_date and end_date are required');
  }
  return { start: parseDdMmYyyy(startDate, 'start_date'), end: parseDdMmYyyy(endDate, 'end_date') };
}

/**
 * Class-level gate is the Attendance tab's master switch — holding it is
 * enough to see "My Attendance"/"My Leaves". The view/approve endpoints
 * below narrow further with their own @RequirePermission, overriding this
 * default (PermissionsGuard uses getAllAndOverride: method wins over class).
 */
@Controller('app')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.tab_attendance.access')
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
  @RequirePermission('mobile_api.attendance.access')
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
  @RequirePermission('mobile_api.attendance.access')
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
  @RequirePermission('mobile_api.attendance.approve')
  async notApproved(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const data = await this.service.listNotApproved(branchId);
    return Reply.dataOnly({ error: false, message: '', data });
  }

  @Get('attendance/approved')
  @RequirePermission('mobile_api.attendance.approve')
  async approved(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const data = await this.service.listApproved(branchId);
    return Reply.dataOnly({ error: false, message: '', data });
  }

  @Post('attendance/approve/:id')
  @RequirePermission('mobile_api.attendance.approve')
  async approve(@Req() req: AuthedRequest, @Param('id') id: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    await this.service.approve(branchId, id, req.user.userId);
    return Reply.success('Attendance request approved and records saved.');
  }

  @Post('attendance/reject/:id')
  @RequirePermission('mobile_api.attendance.approve')
  async reject(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: RejectAttendanceDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    await this.service.reject(branchId, id, req.user.userId, dto.rejection_reason);
    return Reply.success('Attendance request rejected successfully');
  }
}
