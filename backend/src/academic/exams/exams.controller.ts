import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/exams')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class ExamsController {
  constructor(private readonly service: ExamsService) {}

  @Get()
  @RequirePermission('academic.exams.view')
  list(@Param('branchId') branchId: string, @Query('examTypeId') examTypeId?: string) {
    return this.service.list(branchId, examTypeId);
  }

  @Post()
  @RequirePermission('academic.exams.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateExamDto) {
    return this.service.create(branchId, dto);
  }

  @Patch(':id')
  @RequirePermission('academic.exams.manage')
  update(@Param('branchId') branchId: string, @Param('id') id: string, @Body() dto: UpdateExamDto) {
    return this.service.update(branchId, id, dto);
  }
}
