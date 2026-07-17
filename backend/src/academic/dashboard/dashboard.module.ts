import { Module } from '@nestjs/common';
import { AcademicDashboardController } from './dashboard.controller';
import { AcademicDashboardService } from './dashboard.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [AcademicDashboardController],
  providers: [AcademicDashboardService],
  exports: [AcademicDashboardService],
})
export class AcademicDashboardModule {}
