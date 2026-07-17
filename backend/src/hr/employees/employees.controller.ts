import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/employees')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  @RequirePermission('hr.employees.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('hr.employees.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateEmployeeDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('hr.employees.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('hr.employees.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post('bulk-action')
  @RequirePermission('hr.employees.manage')
  bulkAction(@Param('branchId') branchId: string, @Body() dto: BulkActionDto) {
    return this.service.bulkAction(branchId, dto);
  }
}
