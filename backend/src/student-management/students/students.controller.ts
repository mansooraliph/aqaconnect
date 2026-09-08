import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ResetStudentPasswordDto } from './dto/reset-student-password.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/students')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  @RequirePermission('student_management.students.view')
  list(@Param('branchId') branchId: string, @Query('status') status?: string) {
    return this.service.list(branchId, status);
  }

  @Get(':id')
  @RequirePermission('student_management.students.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Post()
  @RequirePermission('student_management.students.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateStudentDto) {
    return this.service.create(branchId, dto);
  }

  @Patch(':id')
  @RequirePermission('student_management.students.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post('bulk-action')
  @RequirePermission('student_management.students.manage')
  bulkAction(@Param('branchId') branchId: string, @Body() dto: BulkActionDto) {
    return this.service.bulkAction(branchId, dto);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermission('student_management.students.manage')
  async resetPassword(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: ResetStudentPasswordDto,
  ) {
    await this.service.resetPassword(branchId, id, dto);
    return { success: true };
  }
}
