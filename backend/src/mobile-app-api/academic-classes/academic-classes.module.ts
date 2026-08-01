import { Module } from '@nestjs/common';
import { AcademicClassesController } from './academic-classes.controller';
import { AcademicClassesService } from './academic-classes.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';

@Module({
  imports: [MobileAppApiCommonModule],
  controllers: [AcademicClassesController],
  providers: [AcademicClassesService],
})
export class AcademicClassesModule {}
