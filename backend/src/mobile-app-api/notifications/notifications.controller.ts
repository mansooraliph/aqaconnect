import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from '../../notifications/notifications.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UnregisterDeviceTokenDto } from './dto/unregister-device-token.dto';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

@Controller('app/notifications')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.notifications.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class MobileNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('device-token')
  async registerDeviceToken(@Req() req: AuthedRequest, @Body() dto: RegisterDeviceTokenDto) {
    await this.service.registerDeviceToken(req.user.userId, dto.token, dto.platform);
    return Reply.success('Device registered for push notifications.');
  }

  @Delete('device-token')
  async unregisterDeviceToken(@Body() dto: UnregisterDeviceTokenDto) {
    await this.service.unregisterDeviceToken(dto.token);
    return Reply.success('Device unregistered.');
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Query('page') page?: string, @Query('limit') limit?: string) {
    const data = await this.service.listForUser(req.user.userId, Number(page) || 1, Number(limit) || 20);
    return Reply.dataOnly({ error: false, data });
  }

  @Post(':id/read')
  async markRead(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.service.markRead(req.user.userId, id);
    return Reply.success('Notification marked as read.');
  }

  @Post('read-all')
  async markAllRead(@Req() req: AuthedRequest) {
    await this.service.markAllRead(req.user.userId);
    return Reply.success('All notifications marked as read.');
  }
}
