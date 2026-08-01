import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

class BulkManageLeaveUpdateItemDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsIn(['home', 'hostal'])
  leave_type?: 'home' | 'hostal';

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  approval_remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  creation_remarks?: string;
}

export class BulkManageLeavesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkManageLeaveUpdateItemDto)
  updates?: BulkManageLeaveUpdateItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deletes?: string[];
}
