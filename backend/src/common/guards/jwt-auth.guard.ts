import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Single, correctly-applied JWT guard for the whole API (registered globally
 * in AppModule). Fixes API_CONTRACTS.md defect D1 from the old system: there,
 * the route-level guard didn't match the guard used inside controller
 * methods, `me()` returned 200+null instead of 401 when unauthenticated, and
 * `logout()` revoked the wrong guard's session. Here there is exactly one
 * guard, and any missing/invalid/expired token always throws a real 401.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or missing access token');
    }
    return user;
  }
}
