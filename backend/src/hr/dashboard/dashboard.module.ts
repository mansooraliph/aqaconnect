import { Module } from '@nestjs/common';
import { HrDashboardController } from './dashboard.controller';
import { HrDashboardService } from './dashboard.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [HrDashboardController],
  providers: [HrDashboardService],
  exports: [HrDashboardService],
})
export class HrDashboardModule {}
