import { Module } from '@nestjs/common';
import { MobileAnnouncementsController } from './announcements.controller';
import { MobileAnnouncementsService } from './announcements.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule, NotificationsModule],
  controllers: [MobileAnnouncementsController],
  providers: [MobileAnnouncementsService],
})
export class MobileAnnouncementsModule {}
