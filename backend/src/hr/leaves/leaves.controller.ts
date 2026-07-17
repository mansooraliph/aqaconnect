import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LeaveStatus } from '@prisma/client';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/leaves')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class LeavesController {
  constructor(private readonly service: LeavesService) {}

  @Get()
  @RequirePermission('hr.leaves.view')
  list(
    @Param('branchId') branchId: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: LeaveStatus,
  ) {
    return this.service.list(branchId, employeeId, status);
  }

  @Post()
  @RequirePermission('hr.leaves.apply')
  create(@Param('branchId') branchId: string, @Body() dto: CreateLeaveDto) {
    return this.service.create(branchId, dto);
  }

  @Post(':id/approve')
  @RequirePermission('hr.leaves.approve')
  approve(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.service.approve(branchId, id, user.userId, dto);
  }

  @Post(':id/reject')
  @RequirePermission('hr.leaves.approve')
  reject(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.service.reject(branchId, id, user.userId, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('hr.leaves.apply')
  cancel(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.cancel(branchId, id);
  }
}
