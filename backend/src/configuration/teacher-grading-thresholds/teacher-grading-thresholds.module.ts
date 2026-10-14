import { Module } from '@nestjs/common';
import { TeacherGradingThresholdsController } from './teacher-grading-thresholds.controller';
import { TeacherGradingThresholdsService } from './teacher-grading-thresholds.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [TeacherGradingThresholdsController],
  providers: [TeacherGradingThresholdsService],
  exports: [TeacherGradingThresholdsService],
})
export class TeacherGradingThresholdsModule {}
