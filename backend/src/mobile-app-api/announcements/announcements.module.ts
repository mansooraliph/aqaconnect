import { Module } from '@nestjs/common';
import { MobileAnnouncementsController } from './announcements.controller';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule],
  controllers: [MobileAnnouncementsController],
})
export class MobileAnnouncementsModule {}
