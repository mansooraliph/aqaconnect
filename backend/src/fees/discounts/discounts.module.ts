import { Module } from '@nestjs/common';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';
import { RbacModule } from '../../rbac/rbac.module';
import { FeeDemandsModule } from '../fee-demands/fee-demands.module';

@Module({
  imports: [RbacModule, FeeDemandsModule],
  controllers: [DiscountsController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
