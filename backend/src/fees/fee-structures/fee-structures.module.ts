import { Module } from '@nestjs/common';
import { FeeStructuresController } from './fee-structures.controller';
import { FeeStructuresService } from './fee-structures.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [FeeStructuresController],
  providers: [FeeStructuresService],
  exports: [FeeStructuresService],
})
export class FeeStructuresModule {}
