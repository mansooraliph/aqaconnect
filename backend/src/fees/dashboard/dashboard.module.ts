import { Module } from '@nestjs/common';
import { FeesDashboardController } from './dashboard.controller';
import { FeesDashboardService } from './dashboard.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [FeesDashboardController],
  providers: [FeesDashboardService],
  exports: [FeesDashboardService],
})
export class FeesDashboardModule {}
