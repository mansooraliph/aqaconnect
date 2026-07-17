import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/** Route requires the caller to hold this permission key (see Permission.key in the schema). */
export const RequirePermission = (permissionKey: string) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permissionKey);
