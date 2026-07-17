import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/students/:studentId/payments')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @RequirePermission('fees.payments.view')
  list(@Param('branchId') branchId: string, @Param('studentId') studentId: string) {
    return this.service.list(branchId, studentId);
  }

  @Post()
  @RequirePermission('fees.payments.create')
  create(
    @Param('branchId') branchId: string,
    @Param('studentId') studentId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.service.create(branchId, studentId, dto);
  }
}

@Controller('branches/:branchId/payments')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class PaymentConfirmationController {
  constructor(private readonly service: PaymentsService) {}

  @Post(':id/confirm')
  @RequirePermission('fees.payments.create')
  confirm(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.confirm(branchId, id);
  }
}
