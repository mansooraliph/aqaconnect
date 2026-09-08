import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/leave-types')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class LeaveTypesController {
  constructor(private readonly service: LeaveTypesService) {}

  @Get()
  @RequirePermission('hr.leave_types.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('hr.leave_types.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateLeaveTypeDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('hr.leave_types.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('hr.leave_types.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
