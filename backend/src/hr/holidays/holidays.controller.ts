import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { ApplyToCalendarDto } from './dto/apply-to-calendar.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/holidays')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  @Get()
  @RequirePermission('hr.holidays.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('hr.holidays.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateHolidayDto) {
    return this.service.create(branchId, dto);
  }

  @Patch(':id')
  @RequirePermission('hr.holidays.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post(':id/apply-to-calendar')
  @RequirePermission('hr.holidays.manage')
  applyToCalendar(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: ApplyToCalendarDto,
  ) {
    return this.service.applyToCalendar(branchId, id, dto);
  }
}
