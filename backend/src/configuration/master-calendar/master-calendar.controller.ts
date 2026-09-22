import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MasterCalendarService } from './master-calendar.service';
import { UpdateMasterCalendarDayDto } from './dto/update-master-calendar-day.dto';
import { InitiateMasterDaysDto } from './dto/initiate-master-days.dto';
import { PublishMasterCalendarDto } from './dto/publish-master-calendar.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

// Global resource — no :branchId, so no BranchScopeGuard. Gated by its own
// `master_calendar` permission module (not `configuration.*`) so a Branch
// Admin's broad configuration-module grant never picks this up.
@Controller('master-calendar')
@UseGuards(PermissionsGuard)
export class MasterCalendarController {
  constructor(private readonly service: MasterCalendarService) {}

  @Get()
  @RequirePermission('master_calendar.view')
  list(@Query('month') month?: string, @Query('year') year?: string) {
    return this.service.list(month !== undefined ? Number(month) : undefined, year !== undefined ? Number(year) : undefined);
  }

  @Get('stats')
  @RequirePermission('master_calendar.view')
  stats(@Query('month') month?: string, @Query('year') year?: string) {
    return this.service.stats(month !== undefined ? Number(month) : undefined, year !== undefined ? Number(year) : undefined);
  }

  @Post('initiate-days')
  @RequirePermission('master_calendar.manage')
  initiateDays(@Body() dto: InitiateMasterDaysDto) {
    return this.service.initiateDays(dto);
  }

  @Post('publish')
  @RequirePermission('master_calendar.manage')
  publish(@Body() dto: PublishMasterCalendarDto) {
    return this.service.publish(dto);
  }

  @Delete('year/:year')
  @RequirePermission('master_calendar.manage')
  clearYear(@Param('year') year: string) {
    return this.service.clearYear(Number(year));
  }

  @Patch(':id')
  @RequirePermission('master_calendar.manage')
  update(@Param('id') id: string, @Body() dto: UpdateMasterCalendarDayDto) {
    return this.service.update(id, dto);
  }
}
