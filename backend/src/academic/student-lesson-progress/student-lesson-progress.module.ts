import { Module } from '@nestjs/common';
import { StudentLessonProgressController } from './student-lesson-progress.controller';
import { StudentLessonProgressService } from './student-lesson-progress.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [StudentLessonProgressController],
  providers: [StudentLessonProgressService],
  exports: [StudentLessonProgressService],
})
export class StudentLessonProgressModule {}
