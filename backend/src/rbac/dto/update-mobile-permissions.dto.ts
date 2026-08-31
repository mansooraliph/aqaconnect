import { IsArray, IsString } from 'class-validator';

export class UpdateMobilePermissionsDto {
  /** Full replacement set of `mobile_api.*` permission keys this role should hold. */
  @IsArray()
  @IsString({ each: true })
  permissionKeys: string[];
}
