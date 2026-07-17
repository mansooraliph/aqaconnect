import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { BranchSettingsService } from './branch-settings.service';
import { UpdateBranchSettingsDto } from './dto/update-branch-settings.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/settings')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class BranchSettingsController {
  constructor(private readonly service: BranchSettingsService) {}

  @Get()
  @RequirePermission('configuration.branch_settings.view')
  findOne(@Param('branchId') branchId: string) {
    return this.service.findOne(branchId);
  }

  @Patch()
  @RequirePermission('configuration.branch_settings.manage')
  update(@Param('branchId') branchId: string, @Body() dto: UpdateBranchSettingsDto) {
    return this.service.update(branchId, dto);
  }
}
