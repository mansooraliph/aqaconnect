import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FeesDashboardService } from './dashboard.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/fees-dashboard')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class FeesDashboardController {
  constructor(private readonly service: FeesDashboardService) {}

  @Get()
  @RequirePermission('fees.demands.view')
  getDashboard(@Param('branchId') branchId: string) {
    return this.service.getDashboard(branchId);
  }
}
