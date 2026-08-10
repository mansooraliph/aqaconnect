import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
