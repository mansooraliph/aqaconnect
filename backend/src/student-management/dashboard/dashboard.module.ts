import { Module } from '@nestjs/common';
import { StudentManagementDashboardController } from './dashboard.controller';
import { StudentManagementDashboardService } from './dashboard.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [StudentManagementDashboardController],
  providers: [StudentManagementDashboardService],
  exports: [StudentManagementDashboardService],
})
export class StudentManagementDashboardModule {}
