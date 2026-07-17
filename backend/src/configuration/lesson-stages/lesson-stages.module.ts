import { Module } from '@nestjs/common';
import { LessonStagesController } from './lesson-stages.controller';
import { LessonStagesService } from './lesson-stages.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [LessonStagesController],
  providers: [LessonStagesService],
  exports: [LessonStagesService],
})
export class LessonStagesModule {}
