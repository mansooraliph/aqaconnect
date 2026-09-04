import { Module } from '@nestjs/common';
import { MobileNotificationsController } from './notifications.controller';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [MobileAppApiCommonModule, NotificationsModule, RbacModule],
  controllers: [MobileNotificationsController],
})
export class MobileNotificationsModule {}
