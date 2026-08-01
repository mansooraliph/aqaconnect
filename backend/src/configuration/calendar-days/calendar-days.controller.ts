import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CalendarDaysService } from './calendar-days.service';
import { GenerateCalendarDaysDto } from './dto/generate-calendar-days.dto';
import { UpdateCalendarDayDto } from './dto/update-calendar-day.dto';
import { InitiateDaysDto } from './dto/initiate-days.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/calendar-days')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class CalendarDaysController {
  constructor(private readonly service: CalendarDaysService) {}

  @Get()
  @RequirePermission('configuration.calendar.view')
  list(
    @Param('branchId') branchId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.list(
      branchId,
      academicYearId,
      month !== undefined ? Number(month) : undefined,
      year !== undefined ? Number(year) : undefined,
    );
  }

  @Get('stats')
  @RequirePermission('configuration.calendar.view')
  stats(
    @Param('branchId') branchId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.stats(
      branchId,
      academicYearId,
      month !== undefined ? Number(month) : undefined,
      year !== undefined ? Number(year) : undefined,
    );
  }

  @Post('generate')
  @RequirePermission('configuration.calendar.manage')
  generate(@Param('branchId') branchId: string, @Body() dto: GenerateCalendarDaysDto) {
    return this.service.generate(branchId, dto);
  }

  @Post('initiate-days')
  @RequirePermission('configuration.calendar.manage')
  initiateDays(@Param('branchId') branchId: string, @Body() dto: InitiateDaysDto) {
    return this.service.initiateDays(branchId, dto);
  }

  @Delete('year/:year')
  @RequirePermission('configuration.calendar.manage')
  clearYear(@Param('branchId') branchId: string, @Param('year') year: string) {
    return this.service.clearYear(branchId, Number(year));
  }

  @Patch(':id')
  @RequirePermission('configuration.calendar.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarDayDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
