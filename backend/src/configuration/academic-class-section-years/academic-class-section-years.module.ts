import { Module } from '@nestjs/common';
import { AcademicClassSectionYearsController } from './academic-class-section-years.controller';
import { AcademicClassSectionYearsService } from './academic-class-section-years.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [AcademicClassSectionYearsController],
  providers: [AcademicClassSectionYearsService],
  exports: [AcademicClassSectionYearsService],
})
export class AcademicClassSectionYearsModule {}
