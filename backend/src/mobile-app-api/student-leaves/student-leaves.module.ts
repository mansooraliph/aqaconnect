import { Module } from '@nestjs/common';
import { StudentLeavesController } from './student-leaves.controller';
import { MobileStudentLeavesService } from './student-leaves.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';

@Module({
  imports: [MobileAppApiCommonModule],
  controllers: [StudentLeavesController],
  providers: [MobileStudentLeavesService],
})
export class StudentLeavesModule {}
