import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MobileApiUsageService } from './mobile-api-usage.service';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

/** Admin-facing usage-history for the Mobile App API (`/api/app/*`) — not itself part of that legacy-mirroring surface. */
@Controller('mobile-api-usage')
@UseGuards(PermissionsGuard)
export class MobileApiUsageController {
  constructor(private readonly service: MobileApiUsageService) {}

  @Get('logs')
  @RequirePermission('system.mobile_api.view')
  list(@Query() query: ListLogsQueryDto) {
    return this.service.list(query);
  }

  @Get('summary')
  @RequirePermission('system.mobile_api.view')
  summary() {
    return this.service.summary();
  }

  @Get('by-user')
  @RequirePermission('system.mobile_api.view')
  byUser() {
    return this.service.byUser();
  }
}
