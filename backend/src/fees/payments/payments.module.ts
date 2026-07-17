import { Module } from '@nestjs/common';
import { PaymentsController, PaymentConfirmationController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RbacModule } from '../../rbac/rbac.module';
import { FeeDemandsModule } from '../fee-demands/fee-demands.module';

@Module({
  imports: [RbacModule, FeeDemandsModule],
  controllers: [PaymentsController, PaymentConfirmationController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
