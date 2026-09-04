import { Module } from '@nestjs/common';
import { StudentSurahProgressController } from './student-surah-progress.controller';
import { StudentSurahProgressService } from './student-surah-progress.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule, NotificationsModule],
  controllers: [StudentSurahProgressController],
  providers: [StudentSurahProgressService],
})
export class StudentSurahProgressModule {}
