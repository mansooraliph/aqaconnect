import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/lessons')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class LessonsController {
  constructor(private readonly service: LessonsService) {}

  @Get()
  @RequirePermission('academic.lessons.view')
  list(
    @Param('branchId') branchId: string,
    @Query('lessonStageId') lessonStageId?: string,
    @Query('lessonSubStageId') lessonSubStageId?: string,
  ) {
    return this.service.list(branchId, lessonStageId, lessonSubStageId);
  }

  @Get('next-order')
  @RequirePermission('academic.lessons.view')
  nextOrder(
    @Param('branchId') branchId: string,
    @Query('lessonStageId') lessonStageId?: string,
  ) {
    return this.service.nextOrder(branchId, lessonStageId);
  }

  @Post()
  @RequirePermission('academic.lessons.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateLessonDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('academic.lessons.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('academic.lessons.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
