import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetCenterPerformanceReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  // Halqa-scoped mode: when provided, narrows the branch-wide report down
  // to just this Halqa's roster (see getCenterPerformanceReport). Snake
  // case to match this controller's other optional query params (e.g.
  // GetAttendanceReportQueryDto.halqa_id, GetTopStudentsQueryDto.halqa_id).
  @IsOptional()
  @IsString()
  halqa_id?: string;
}
