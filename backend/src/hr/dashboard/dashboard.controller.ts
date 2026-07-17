import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HrDashboardService } from './dashboard.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/hr-dashboard')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class HrDashboardController {
  constructor(private readonly service: HrDashboardService) {}

  @Get()
  @RequirePermission('hr.employees.view')
  getDashboard(@Param('branchId') branchId: string) {
    return this.service.getDashboard(branchId);
  }
}
