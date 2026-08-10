import { Module } from '@nestjs/common';
import { LessonStagesController, LessonsController } from './lesson-content.controller';
import { LessonContentService } from './lesson-content.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';
import { LessonsModule } from '../../academic/lessons/lessons.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule, LessonsModule],
  controllers: [LessonStagesController, LessonsController],
  providers: [LessonContentService],
})
export class LessonContentModule {}
