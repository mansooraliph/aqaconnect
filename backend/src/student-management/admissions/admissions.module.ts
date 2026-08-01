import { Module } from '@nestjs/common';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { RbacModule } from '../../rbac/rbac.module';
import { HifdhModule } from '../../academic/hifdh/hifdh.module';

@Module({
  imports: [RbacModule, HifdhModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
})
export class AdmissionsModule {}
