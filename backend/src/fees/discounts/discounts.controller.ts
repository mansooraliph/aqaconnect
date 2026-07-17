import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/fee-demands/:demandId')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}

  @Post('discount')
  @RequirePermission('fees.discounts.create')
  create(
    @Param('branchId') branchId: string,
    @Param('demandId') demandId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiscountDto,
  ) {
    return this.service.create(branchId, demandId, user.userId, dto);
  }

  @Get('allocations')
  @RequirePermission('fees.discounts.view')
  listAllocations(@Param('branchId') branchId: string, @Param('demandId') demandId: string) {
    return this.service.listAllocations(branchId, demandId);
  }
}
