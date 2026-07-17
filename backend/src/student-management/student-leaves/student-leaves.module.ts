import { Module } from '@nestjs/common';
import { StudentLeavesController } from './student-leaves.controller';
import { StudentLeavesService } from './student-leaves.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [StudentLeavesController],
  providers: [StudentLeavesService],
  exports: [StudentLeavesService],
})
export class StudentLeavesModule {}
