import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LessonStagesService } from './lesson-stages.service';
import { CreateLessonStageDto } from './dto/create-lesson-stage.dto';
import { UpdateLessonStageDto } from './dto/update-lesson-stage.dto';
import { ReorderLessonStageDto } from './dto/reorder-lesson-stage.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('lesson-stages')
@UseGuards(PermissionsGuard)
export class LessonStagesController {
  constructor(private readonly service: LessonStagesService) {}

  @Get()
  @RequirePermission('configuration.lesson_stages.view')
  list() {
    return this.service.list();
  }

  @Get('next-order')
  @RequirePermission('configuration.lesson_stages.view')
  nextOrder() {
    return this.service.nextOrder();
  }

  @Post()
  @RequirePermission('configuration.lesson_stages.manage')
  create(@Body() dto: CreateLessonStageDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  @RequirePermission('configuration.lesson_stages.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('configuration.lesson_stages.manage')
  update(@Param('id') id: string, @Body() dto: UpdateLessonStageDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/reorder')
  @RequirePermission('configuration.lesson_stages.manage')
  reorder(@Param('id') id: string, @Body() dto: ReorderLessonStageDto) {
    return this.service.reorder(id, dto);
  }

  @Post('bulk-action')
  @RequirePermission('configuration.lesson_stages.manage')
  bulkAction(@Body() dto: BulkActionDto) {
    return this.service.bulkAction(dto);
  }
}
