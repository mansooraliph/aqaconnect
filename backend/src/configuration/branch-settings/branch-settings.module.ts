import { Module } from '@nestjs/common';
import { BranchSettingsController } from './branch-settings.controller';
import { BranchSettingsService } from './branch-settings.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [BranchSettingsController],
  providers: [BranchSettingsService],
  exports: [BranchSettingsService],
})
export class BranchSettingsModule {}
