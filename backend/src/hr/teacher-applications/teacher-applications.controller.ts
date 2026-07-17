import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TeacherApplicationsService } from './teacher-applications.service';
import { CreateTeacherApplicationDto } from './dto/create-teacher-application.dto';
import {
  RejectTeacherApplicationDto,
  ReviewTeacherApplicationDto,
} from './dto/review-teacher-application.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/teacher-applications')
@UseGuards(PermissionsGuard, BranchScopeGuard)
@RequirePermission('hr.teacher_applications.view')
export class TeacherApplicationsController {
  constructor(private readonly service: TeacherApplicationsService) {}

  @Get()
  list(@Param('branchId') branchId: string, @Query('status') status?: string) {
    return this.service.list(branchId, status);
  }

  @Get(':id')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Post()
  @RequirePermission('hr.teacher_applications.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateTeacherApplicationDto) {
    return this.service.create(branchId, dto);
  }

  @Post(':id/approve')
  @RequirePermission('hr.teacher_applications.manage')
  approve(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewTeacherApplicationDto,
  ) {
    return this.service.approve(branchId, id, user.userId, dto);
  }

  @Post(':id/reject')
  @RequirePermission('hr.teacher_applications.manage')
  reject(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectTeacherApplicationDto,
  ) {
    return this.service.reject(branchId, id, user.userId, dto);
  }
}
