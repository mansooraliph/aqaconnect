import { Module } from '@nestjs/common';
import { FeeTypesController } from './fee-types.controller';
import { FeeTypesService } from './fee-types.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [FeeTypesController],
  providers: [FeeTypesService],
  exports: [FeeTypesService],
})
export class FeeTypesModule {}
