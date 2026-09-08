import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class BulkAssignLeaveQuotaDto {
  @IsString()
  @MinLength(1)
  leaveTypeId: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  /** Overrides the LeaveType's own defaultDays for this run. Required if the LeaveType has no defaultDays set. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDays?: number;
}
