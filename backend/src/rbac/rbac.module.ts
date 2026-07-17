import { Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { RbacController } from './rbac.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';

@Module({
  controllers: [RbacController],
  providers: [AccessControlService, PermissionsGuard, BranchScopeGuard],
  exports: [AccessControlService, PermissionsGuard, BranchScopeGuard],
})
export class RbacModule {}
