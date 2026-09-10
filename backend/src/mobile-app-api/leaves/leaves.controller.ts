import { Body, Controller, Get, HttpException, Param, Post, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { MobileLeavesService } from './leaves.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { MobileApproveLeaveDto } from './dto/approve-leave.dto';
import { MobileCancelLeaveDto } from './dto/cancel-leave.dto';
import { MobileRejectLeaveDto } from './dto/reject-leave.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

@Controller('app')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.leaves.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class LeavesController {
  constructor(
    private readonly service: MobileLeavesService,
    private readonly context: MobileContextService,
  ) {}

  @Get('leaves/types')
  async types(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const types = await this.service.listTypes(branchId);
    return { status: 'success', data: types.map((t) => ({ id: t.id, name: t.name })) };
  }

  @Get('leaves/approvals')
  @RequirePermission('mobile_api.leaves.approve')
  async approvals(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.service.approvals(branchId);
  }

  @Get('leaves/my-leaves')
  async myLeaves(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.service.myLeaves(branchId, req.user.userId);
  }

  // The client always sends multipart/form-data here (attachments under
  // dynamic field names like attachments[0], attachments[1], ...), so
  // AnyFilesInterceptor is needed just to get Multer to parse the text
  // fields — attachments themselves are received and discarded, no file
  // storage exists yet.
  @Post('leaves/apply-leave')
  @UseInterceptors(AnyFilesInterceptor())
  async applyLeave(@Req() req: AuthedRequest, @Body() dto: ApplyLeaveDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      const leave = await this.service.applyLeave(branchId, req.user.userId, dto);
      return Reply.successWithData('Leave request applied successfully', { data: leave });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return Reply.error((error as Error).message);
    }
  }

  @Post('attendance/approve-leave')
  @RequirePermission('mobile_api.leaves.approve')
  async approveLeave(@Req() req: AuthedRequest, @Body() dto: MobileApproveLeaveDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      const leave = await this.service.approveLeave(branchId, req.user.userId, dto.leave_id);
      return Reply.successWithData('Leave request approved successfully', { data: leave });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return Reply.error((error as Error).message);
    }
  }

  @Post('leaves/:id/reject')
  @RequirePermission('mobile_api.leaves.approve')
  async reject(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: MobileRejectLeaveDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const leave = await this.service.rejectLeave(branchId, req.user.userId, id, dto);
    return { status: 'success', message: 'Leave request rejected', data: leave };
  }

  @Post('attendance/cancel-leave')
  async cancelLeave(@Req() req: AuthedRequest, @Body() dto: MobileCancelLeaveDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      await this.service.cancelLeave(branchId, req.user.userId, dto.leave_id);
      return Reply.success('Leave request canceled successfully');
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return Reply.error((error as Error).message);
    }
  }
}
