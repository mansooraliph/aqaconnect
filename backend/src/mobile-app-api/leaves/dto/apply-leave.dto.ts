import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class ApplyLeaveDto {
  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsString()
  @MinLength(1)
  type: string; // LeaveType id

  @IsOptional()
  @IsBoolean()
  is_half_day?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}
