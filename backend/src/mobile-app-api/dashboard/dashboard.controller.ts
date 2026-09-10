import { Controller, Get, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

@Controller('app')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.dashboard.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('teacher-dashboard')
  async teacherDashboard(@Req() req: AuthedRequest) {
    const data = await this.service.teacherDashboard(req.user.userId);
    return Reply.dataOnly({ error: false, data });
  }

  @Get('admin-dashboard')
  async adminDashboard(@Req() req: AuthedRequest) {
    const data = await this.service.adminDashboard(req.user.userId);
    return Reply.dataOnly({ error: false, data });
  }
}
