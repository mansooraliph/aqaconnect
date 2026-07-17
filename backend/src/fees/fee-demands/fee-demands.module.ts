import { Module } from '@nestjs/common';
import { FeeStructureDemandsController, StudentFeeDemandsController } from './fee-demands.controller';
import { FeeDemandsService } from './fee-demands.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [FeeStructureDemandsController, StudentFeeDemandsController],
  providers: [FeeDemandsService],
  exports: [FeeDemandsService],
})
export class FeeDemandsModule {}
