import { Module } from '@nestjs/common';
import { StudentSurahProgressController } from './student-surah-progress.controller';
import { StudentSurahProgressService } from './student-surah-progress.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule],
  controllers: [StudentSurahProgressController],
  providers: [StudentSurahProgressService],
})
export class StudentSurahProgressModule {}
