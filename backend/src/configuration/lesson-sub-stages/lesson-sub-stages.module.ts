import { Module } from '@nestjs/common';
import { LessonSubStagesController } from './lesson-sub-stages.controller';
import { LessonSubStagesService } from './lesson-sub-stages.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [LessonSubStagesController],
  providers: [LessonSubStagesService],
  exports: [LessonSubStagesService],
})
export class LessonSubStagesModule {}
