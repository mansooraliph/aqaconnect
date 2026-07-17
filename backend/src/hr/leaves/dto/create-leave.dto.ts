import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLeaveDto {
  @IsString()
  @MinLength(1)
  employeeId: string;

  @IsString()
  @MinLength(1)
  leaveType: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isHalfDay?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}
