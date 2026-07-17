import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { StudentManagementDashboardService } from './dashboard.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/student-management-dashboard')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class StudentManagementDashboardController {
  constructor(private readonly service: StudentManagementDashboardService) {}

  @Get()
  @RequirePermission('student_management.admissions.view')
  getDashboard(@Param('branchId') branchId: string) {
    return this.service.getDashboard(branchId);
  }
}
