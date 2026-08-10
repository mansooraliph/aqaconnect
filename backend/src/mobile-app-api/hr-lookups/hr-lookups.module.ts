import { Module } from '@nestjs/common';
import { HrLookupsController } from './hr-lookups.controller';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';
import { DepartmentsModule } from '../../hr/departments/departments.module';
import { DesignationsModule } from '../../hr/designations/designations.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule, DepartmentsModule, DesignationsModule],
  controllers: [HrLookupsController],
})
export class HrLookupsModule {}
