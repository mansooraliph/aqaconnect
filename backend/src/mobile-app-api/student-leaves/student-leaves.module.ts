import { Module } from '@nestjs/common';
import { StudentLeavesController } from './student-leaves.controller';
import { MobileStudentLeavesService } from './student-leaves.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule],
  controllers: [StudentLeavesController],
  providers: [MobileStudentLeavesService],
})
export class StudentLeavesModule {}
