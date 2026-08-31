import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { MobileStudentLeavesService } from './student-leaves.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { CreateLeaveForStudentDto } from './dto/create-leave-for-student.dto';
import { BulkReviewLeavesDto } from './dto/bulk-review-leaves.dto';
import { GetLeavesQueryDto } from './dto/get-leaves-query.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { BulkManageLeavesDto } from './dto/bulk-manage-leaves.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';

interface AuthedRequest extends Request {
  user: { userId: string };
}

/** Mirrors legacy `Route::prefix('student_leave')->group(...)`, i.e. `/api/app/student_leave`. Note: this legacy controller never uses the `Reply` helper — every response is a plain `{message, ...}` array, with no `status` envelope key. */
@Controller('app/student_leave')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.student_leaves.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class StudentLeavesController {
  constructor(
    private readonly service: MobileStudentLeavesService,
    private readonly context: MobileContextService,
  ) {}

  @Post('leave-apply')
  @HttpCode(201)
  async applyLeave(@Req() req: AuthedRequest, @Body() dto: ApplyLeaveDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.context.resolveOwnStudentId(req.user.userId);
    try {
      return await this.service.applyLeave(branchId, req.user.userId, studentId, dto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Failed to apply leave. Please try again.',
        error: (error as Error).message,
      });
    }
  }

  @Post('create-student-leave')
  @HttpCode(201)
  async createLeaveForStudent(@Req() req: AuthedRequest, @Body() dto: CreateLeaveForStudentDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    if (!(await this.service.isTeacherOrAdmin(req.user.userId))) {
      throw new ForbiddenException('Unauthorized. Only teachers or admins can perform this action.');
    }
    try {
      return await this.service.createLeaveForStudent(branchId, req.user.userId, dto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Failed to create leave. Please try again.',
        error: (error as Error).message,
      });
    }
  }

  @Post('leave-approval')
  async bulkReviewLeaves(@Req() req: AuthedRequest, @Body() dto: BulkReviewLeavesDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    if (!(await this.service.isTeacherOrAdmin(req.user.userId))) {
      throw new ForbiddenException('Unauthorized.');
    }
    try {
      return await this.service.bulkReviewLeaves(branchId, req.user.userId, dto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({ message: 'Bulk update failed.', error: (error as Error).message });
    }
  }

  @Get('get-student-leaves')
  async getLeaves(@Req() req: AuthedRequest, @Query() query: GetLeavesQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.service.getLeaves(branchId, req.user.userId, query);
  }

  @Patch('update-leaves/:leaveId')
  async updateLeave(@Req() req: AuthedRequest, @Param('leaveId') leaveId: string, @Body() dto: UpdateLeaveDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    if (!(await this.service.isTeacherOrAdmin(req.user.userId))) {
      throw new ForbiddenException('Unauthorized. Only teachers or admins can update leave records.');
    }
    const existing = await this.service.findLeaveOrNull(branchId, leaveId);
    if (!existing) {
      throw new NotFoundException('Leave record not found.');
    }
    try {
      return await this.service.updateLeave(branchId, req.user.userId, leaveId, dto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Failed to update leave range.',
        error: (error as Error).message,
      });
    }
  }

  @Post('bulk-manage')
  async bulkManageLeaves(@Req() req: AuthedRequest, @Body() dto: BulkManageLeavesDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    if (!(await this.service.isTeacherOrAdmin(req.user.userId))) {
      throw new ForbiddenException('Unauthorized. Only teachers or admins can perform this action.');
    }
    try {
      return await this.service.bulkManageLeaves(branchId, req.user.userId, dto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Bulk operation failed. All changes rolled back.',
        error: (error as Error).message,
      });
    }
  }
}
