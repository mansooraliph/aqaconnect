import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { AccessControlService } from '../../rbac/access-control.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControl: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequirePermission on this route: any authenticated user may proceed.
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId: string } | undefined;
    if (!user) {
      // JwtAuthGuard should already have rejected unauthenticated requests; this
      // only guards against a route that forgets to require auth but requires a permission.
      throw new ForbiddenException('Authentication required');
    }

    const accessContext = await this.accessControl.getUserAccessContext(user.userId);
    request.accessContext = accessContext;

    if (!accessContext.permissions.has(requiredPermission)) {
      throw new ForbiddenException(`Missing required permission: ${requiredPermission}`);
    }

    return true;
  }
}
