import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/teachers')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  @Get()
  @RequirePermission('hr.teachers.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('hr.teachers.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateTeacherDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('hr.teachers.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('hr.teachers.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
