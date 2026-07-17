import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentClassesService } from './current-classes.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/current-classes')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class CurrentClassesController {
  constructor(private readonly service: CurrentClassesService) {}

  @Get()
  @RequirePermission('academic.current_classes.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }
}
