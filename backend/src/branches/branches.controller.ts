import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from '../rbac/access-control.service';

@Controller('branches')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  @RequirePermission('system.branches.view')
  async list(@CurrentUser() user: AuthenticatedUser) {
    const accessContext = await this.accessControl.getUserAccessContext(user.userId);
    return this.branchesService.listForUser(accessContext);
  }

  @Post()
  @RequirePermission('system.branches.manage')
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Get(':branchId')
  @RequirePermission('system.branches.view')
  findOne(@Param('branchId') branchId: string) {
    return this.branchesService.findOne(branchId);
  }

  @Patch(':branchId')
  @RequirePermission('system.branches.manage')
  update(@Param('branchId') branchId: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(branchId, dto);
  }
}
