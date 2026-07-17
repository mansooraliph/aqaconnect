import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLeaveQuotaDto {
  @IsString()
  @MinLength(1)
  employeeId: string;

  @IsString()
  @MinLength(1)
  leaveType: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsNumber()
  @Min(0)
  totalDays: number;
}
