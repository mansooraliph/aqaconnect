import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  providers: [NotificationsService, FirebaseAdminService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
