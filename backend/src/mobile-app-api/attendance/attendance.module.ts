import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { MobileAttendanceService } from './attendance.service';
import { AttendanceReportService } from './attendance-report.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule],
  controllers: [AttendanceController],
  providers: [MobileAttendanceService, AttendanceReportService],
})
export class MobileAttendanceModule {}
