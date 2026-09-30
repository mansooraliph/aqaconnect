import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { BranchSettingsService } from './branch-settings.service';
import { UpdateBranchSettingsDto } from './dto/update-branch-settings.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccessControlService } from '../../rbac/access-control.service';

@Controller('branches/:branchId/settings')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class BranchSettingsController {
  constructor(
    private readonly service: BranchSettingsService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  @RequirePermission('configuration.branch_settings.view')
  findOne(@Param('branchId') branchId: string) {
    return this.service.findOne(branchId);
  }

  @Patch()
  @RequirePermission('configuration.branch_settings.manage')
  async update(
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const accessContext = await this.accessControl.getUserAccessContext(user.userId);
    return this.service.update(branchId, dto, accessContext);
  }
}
