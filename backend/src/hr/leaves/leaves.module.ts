import { Module } from '@nestjs/common';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { LeaveQuotasController } from './leave-quotas.controller';
import { LeaveQuotasService } from './leave-quotas.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [LeavesController, LeaveQuotasController],
  providers: [LeavesService, LeaveQuotasService],
  exports: [LeavesService, LeaveQuotasService],
})
export class LeavesModule {}
