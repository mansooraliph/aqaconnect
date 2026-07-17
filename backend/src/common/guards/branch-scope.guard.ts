import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AccessControlService, UserAccessContext } from '../../rbac/access-control.service';

/**
 * Enforces the brief's core multi-branch rule: a request targeting a specific
 * branch (via :branchId route param, or body.branchId) is only allowed if the
 * caller is branch-agnostic (holds a GLOBAL-scope role) or is explicitly
 * assigned to that branch. Routes with no identifiable target branch (e.g.
 * "list branches I can access") pass through untouched — the service layer
 * is responsible for filtering those results by accessContext.allowedBranchIds.
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  constructor(private readonly accessControl: AccessControlService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const targetBranchId: string | undefined =
      request.params?.branchId ?? request.body?.branchId;

    if (!targetBranchId) {
      return true;
    }

    const user = request.user as { userId: string } | undefined;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const accessContext: UserAccessContext =
      request.accessContext ?? (await this.accessControl.getUserAccessContext(user.userId));
    request.accessContext = accessContext;

    if (!this.accessControl.canAccessBranch(accessContext, targetBranchId)) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    return true;
  }
}
