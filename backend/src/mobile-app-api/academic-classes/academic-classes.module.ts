import { Module } from '@nestjs/common';
import { AcademicClassesController } from './academic-classes.controller';
import { AcademicClassesService } from './academic-classes.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule],
  controllers: [AcademicClassesController],
  providers: [AcademicClassesService],
})
export class AcademicClassesModule {}
