import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLeaveDto {
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
