import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ChangeParentDto } from './dto/change-parent.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/departments')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  @RequirePermission('hr.departments.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('hr.departments.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateDepartmentDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('hr.departments.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('hr.departments.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post(':id/change-parent')
  @RequirePermission('hr.departments.manage')
  changeParent(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: ChangeParentDto,
  ) {
    return this.service.changeParent(branchId, id, dto);
  }
}
