import { Module } from '@nestjs/common';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
})
export class AdmissionsModule {}
