import { Module } from '@nestjs/common';
import { MobileApiUsageController } from './mobile-api-usage.controller';
import { MobileApiUsageService } from './mobile-api-usage.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [MobileApiUsageController],
  providers: [MobileApiUsageService],
})
export class MobileApiUsageModule {}
