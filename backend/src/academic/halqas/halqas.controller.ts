import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { HalqasService } from './halqas.service';
import { CreateHalqaDto } from './dto/create-halqa.dto';
import { UpdateHalqaDto } from './dto/update-halqa.dto';
import { AssignStudentDto } from './dto/assign-student.dto';
import { RemoveStudentDto } from './dto/remove-student.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/halqas')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class HalqasController {
  constructor(private readonly service: HalqasService) {}

  @Get()
  @RequirePermission('academic.halqas.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('academic.halqas.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateHalqaDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('academic.halqas.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('academic.halqas.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHalqaDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post(':id/assign-student')
  @RequirePermission('academic.halqas.manage')
  assignStudent(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: AssignStudentDto,
  ) {
    return this.service.assignStudent(branchId, id, dto);
  }

  @Post(':id/remove-student')
  @RequirePermission('academic.halqas.manage')
  removeStudent(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: RemoveStudentDto,
  ) {
    return this.service.removeStudent(branchId, id, dto);
  }

  @Get(':id/unassigned-students')
  @RequirePermission('academic.halqas.view')
  unassignedStudents(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.unassignedStudents(branchId, id);
  }
}
