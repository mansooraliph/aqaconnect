import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';
import { StudentSurahProgressModule } from '../student-surah-progress/student-surah-progress.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule, StudentSurahProgressModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class MobileDashboardModule {}
