import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { ApproveAdmissionDto, RejectAdmissionDto } from './dto/approve-admission.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/admissions')
@UseGuards(PermissionsGuard, BranchScopeGuard)
@RequirePermission('student_management.admissions.view')
export class AdmissionsController {
  constructor(private readonly service: AdmissionsService) {}

  @Get()
  list(@Param('branchId') branchId: string, @Query('status') status?: string) {
    return this.service.list(branchId, status);
  }

  @Get(':id')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Post()
  @RequirePermission('student_management.admissions.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateAdmissionDto) {
    return this.service.create(branchId, dto);
  }

  @Post(':id/approve')
  @RequirePermission('student_management.admissions.manage')
  approve(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApproveAdmissionDto,
  ) {
    return this.service.approve(branchId, id, user.userId, dto);
  }

  @Post(':id/reject')
  @RequirePermission('student_management.admissions.manage')
  reject(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectAdmissionDto,
  ) {
    return this.service.reject(branchId, id, user.userId, dto);
  }
}
