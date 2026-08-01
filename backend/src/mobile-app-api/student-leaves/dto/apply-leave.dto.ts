import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyLeaveDto {
  @IsString()
  from_date!: string;

  @IsString()
  to_date!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsIn(['home', 'hostal'])
  leave_type?: 'home' | 'hostal';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  creation_remarks?: string;
}
