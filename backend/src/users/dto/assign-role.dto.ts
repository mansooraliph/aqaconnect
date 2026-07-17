import { IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  roleId: string;

  /** Optional: overrides the user's home branch for this specific BRANCH-scope role grant. */
  @IsOptional()
  @IsString()
  branchId?: string;
}
