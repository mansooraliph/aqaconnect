import { Module } from '@nestjs/common';
import { ExamTypesController } from './exam-types.controller';
import { ExamTypesService } from './exam-types.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [ExamTypesController],
  providers: [ExamTypesService],
  exports: [ExamTypesService],
})
export class ExamTypesModule {}
