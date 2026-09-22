import { Module } from '@nestjs/common';
import { MasterAcademicYearsController } from './master-academic-years.controller';
import { MasterAcademicYearsService } from './master-academic-years.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [MasterAcademicYearsController],
  providers: [MasterAcademicYearsService],
  exports: [MasterAcademicYearsService],
})
export class MasterAcademicYearsModule {}
