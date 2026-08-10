import { Module } from '@nestjs/common';
import { LeavesController } from './leaves.controller';
import { MobileLeavesService } from './leaves.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';
import { LeavesModule as HrLeavesModule } from '../../hr/leaves/leaves.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule, HrLeavesModule],
  controllers: [LeavesController],
  providers: [MobileLeavesService],
})
export class LeavesModule {}
