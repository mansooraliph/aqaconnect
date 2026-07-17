import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { StudentLeaveStatus } from '@prisma/client';
import { StudentLeavesService } from './student-leaves.service';
import { CreateStudentLeaveDto } from './dto/create-student-leave.dto';
import { ApproveStudentLeaveDto } from './dto/approve-student-leave.dto';
import { RejectStudentLeaveDto } from './dto/reject-student-leave.dto';
import { BulkManageStudentLeavesDto } from './dto/bulk-manage-student-leaves.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/student-leaves')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class StudentLeavesController {
  constructor(private readonly service: StudentLeavesService) {}

  @Get()
  @RequirePermission('student_management.student_leaves.view')
  list(
    @Param('branchId') branchId: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: StudentLeaveStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.service.list(branchId, studentId, status, fromDate, toDate);
  }

  @Post()
  @RequirePermission('student_management.student_leaves.apply')
  create(
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStudentLeaveDto,
  ) {
    return this.service.create(branchId, user.userId, dto);
  }

  @Post(':id/approve')
  @RequirePermission('student_management.student_leaves.approve')
  approve(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApproveStudentLeaveDto,
  ) {
    return this.service.approve(branchId, id, user.userId, dto);
  }

  @Post(':id/reject')
  @RequirePermission('student_management.student_leaves.approve')
  reject(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectStudentLeaveDto,
  ) {
    return this.service.reject(branchId, id, user.userId, dto);
  }

  @Post('bulk-manage')
  @RequirePermission('student_management.student_leaves.approve')
  bulkManage(
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkManageStudentLeavesDto,
  ) {
    return this.service.bulkManage(branchId, user.userId, dto);
  }
}
