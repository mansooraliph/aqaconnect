import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SurahTargetSchedulesService } from './surah-target-schedules.service';
import { CreateSurahTargetScheduleDto } from './dto/create-surah-target-schedule.dto';
import { UpdateSurahTargetScheduleDto } from './dto/update-surah-target-schedule.dto';
import { UpsertSurahTargetsDto } from './dto/upsert-surah-target.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('surah-target-schedules')
@UseGuards(PermissionsGuard)
export class SurahTargetSchedulesController {
  constructor(private readonly service: SurahTargetSchedulesService) {}

  @Get()
  @RequirePermission('configuration.target_schedules.view')
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermission('configuration.target_schedules.manage')
  create(@Body() dto: CreateSurahTargetScheduleDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  @RequirePermission('configuration.target_schedules.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('configuration.target_schedules.manage')
  update(@Param('id') id: string, @Body() dto: UpdateSurahTargetScheduleDto) {
    return this.service.update(id, dto);
  }

  @Get(':id/targets')
  @RequirePermission('configuration.target_schedules.view')
  listTargets(@Param('id') id: string) {
    return this.service.listTargets(id);
  }

  @Post(':id/targets')
  @RequirePermission('configuration.target_schedules.manage')
  upsertTargets(@Param('id') id: string, @Body() dto: UpsertSurahTargetsDto) {
    return this.service.upsertTargets(id, dto);
  }
}
