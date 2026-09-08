import { Module } from '@nestjs/common';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesService } from './leave-types.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [LeaveTypesController],
  providers: [LeaveTypesService],
  exports: [LeaveTypesService],
})
export class LeaveTypesModule {}
