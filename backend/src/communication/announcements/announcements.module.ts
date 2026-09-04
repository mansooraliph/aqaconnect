import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { RbacModule } from '../../rbac/rbac.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [RbacModule, NotificationsModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
