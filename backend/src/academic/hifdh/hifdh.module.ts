import { Module } from '@nestjs/common';
import { HifdhSchedulesController, StudentSurahProgressController } from './hifdh.controller';
import { HifdhService } from './hifdh.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [HifdhSchedulesController, StudentSurahProgressController],
  providers: [HifdhService],
  exports: [HifdhService],
})
export class HifdhModule {}
