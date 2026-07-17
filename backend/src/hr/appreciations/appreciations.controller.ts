import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AppreciationsService } from './appreciations.service';
import { CreateAppreciationDto } from './dto/create-appreciation.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

// Appreciations are immutable recognition records once given — the Appreciation
// model has no status field and this API deliberately exposes no PATCH/delete
// route. This mirrors intent, not an oversight: a "given" appreciation is a
// historical fact, not a record meant to be edited later.
@Controller('branches/:branchId/appreciations')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AppreciationsController {
  constructor(private readonly service: AppreciationsService) {}

  @Get()
  @RequirePermission('hr.appreciations.view')
  list(@Param('branchId') branchId: string, @Query('employeeId') employeeId?: string) {
    return this.service.list(branchId, employeeId);
  }

  @Post()
  @RequirePermission('hr.appreciations.create')
  create(
    @Param('branchId') branchId: string,
    @Body() dto: CreateAppreciationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(branchId, dto, user?.userId);
  }
}
