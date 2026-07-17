import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AcademicDashboardService } from './dashboard.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/academic-dashboard')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AcademicDashboardController {
  constructor(private readonly service: AcademicDashboardService) {}

  @Get()
  @RequirePermission('academic.dashboard.view')
  getDashboard(@Param('branchId') branchId: string) {
    return this.service.getDashboard(branchId);
  }
}
