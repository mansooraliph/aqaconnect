import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ExamTypesService } from './exam-types.service';
import { CreateExamTypeDto } from './dto/create-exam-type.dto';
import { UpdateExamTypeDto } from './dto/update-exam-type.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/exam-types')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class ExamTypesController {
  constructor(private readonly service: ExamTypesService) {}

  @Get()
  @RequirePermission('academic.exam_types.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('academic.exam_types.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateExamTypeDto) {
    return this.service.create(branchId, dto);
  }

  @Patch(':id')
  @RequirePermission('academic.exam_types.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExamTypeDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
