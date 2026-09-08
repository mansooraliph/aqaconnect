import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LeaveQuotasService } from './leave-quotas.service';
import { CreateLeaveQuotaDto } from './dto/create-leave-quota.dto';
import { UpdateLeaveQuotaDto } from './dto/update-leave-quota.dto';
import { BulkAssignLeaveQuotaDto } from './dto/bulk-assign-leave-quota.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/leave-quotas')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class LeaveQuotasController {
  constructor(private readonly service: LeaveQuotasService) {}

  @Get()
  @RequirePermission('hr.leave_quotas.view')
  list(@Param('branchId') branchId: string, @Query('employeeId') employeeId?: string) {
    return this.service.list(branchId, employeeId);
  }

  @Post()
  @RequirePermission('hr.leave_quotas.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateLeaveQuotaDto) {
    return this.service.create(branchId, dto);
  }

  @Post('bulk-assign')
  @RequirePermission('hr.leave_quotas.manage')
  bulkAssign(@Param('branchId') branchId: string, @Body() dto: BulkAssignLeaveQuotaDto) {
    return this.service.bulkAssign(branchId, dto);
  }

  @Patch(':id')
  @RequirePermission('hr.leave_quotas.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveQuotaDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
