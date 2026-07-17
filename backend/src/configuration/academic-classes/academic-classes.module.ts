import { Module } from '@nestjs/common';
import { AcademicClassesController } from './academic-classes.controller';
import { AcademicClassesService } from './academic-classes.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [AcademicClassesController],
  providers: [AcademicClassesService],
  exports: [AcademicClassesService],
})
export class AcademicClassesModule {}
