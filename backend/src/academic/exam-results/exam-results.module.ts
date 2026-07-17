import { Module } from '@nestjs/common';
import { ExamResultsController } from './exam-results.controller';
import { ExamResultsService } from './exam-results.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [ExamResultsController],
  providers: [ExamResultsService],
  exports: [ExamResultsService],
})
export class ExamResultsModule {}
