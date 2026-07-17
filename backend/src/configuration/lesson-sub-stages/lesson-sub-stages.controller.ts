import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LessonSubStagesService } from './lesson-sub-stages.service';
import { CreateLessonSubStageDto } from './dto/create-lesson-sub-stage.dto';
import { UpdateLessonSubStageDto } from './dto/update-lesson-sub-stage.dto';
import { ReorderLessonSubStageDto } from './dto/reorder-lesson-sub-stage.dto';
import { ListLessonSubStageQueryDto } from './dto/list-lesson-sub-stage-query.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('lesson-sub-stages')
@UseGuards(PermissionsGuard)
export class LessonSubStagesController {
  constructor(private readonly service: LessonSubStagesService) {}

  @Get()
  @RequirePermission('configuration.lesson_sub_stages.view')
  list(@Query() query: ListLessonSubStageQueryDto) {
    return this.service.list(query.lessonStageId);
  }

  @Get('next-order')
  @RequirePermission('configuration.lesson_sub_stages.view')
  nextOrder(@Query() query: ListLessonSubStageQueryDto) {
    return this.service.nextOrder(query.lessonStageId);
  }

  @Post()
  @RequirePermission('configuration.lesson_sub_stages.manage')
  create(@Body() dto: CreateLessonSubStageDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  @RequirePermission('configuration.lesson_sub_stages.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('configuration.lesson_sub_stages.manage')
  update(@Param('id') id: string, @Body() dto: UpdateLessonSubStageDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/reorder')
  @RequirePermission('configuration.lesson_sub_stages.manage')
  reorder(@Param('id') id: string, @Body() dto: ReorderLessonSubStageDto) {
    return this.service.reorder(id, dto);
  }

  @Post('bulk-action')
  @RequirePermission('configuration.lesson_sub_stages.manage')
  bulkAction(@Body() dto: BulkActionDto) {
    return this.service.bulkAction(dto);
  }
}
