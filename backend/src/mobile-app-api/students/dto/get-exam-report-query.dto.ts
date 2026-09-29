import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetExamReportQueryDto {
  @IsString()
  from_date!: string;

  @IsString()
  to_date!: string;

  @IsOptional()
  @IsString()
  halqa_id?: string;

  @IsOptional()
  @IsString()
  student_id?: string;

  // Filters the exam list (and the per-student summary counts) to a single
  // result — display-label values, matching what the exam list already
  // returns per entry.
  @IsOptional()
  @IsIn(['Pass', 'fail', 'preparation'])
  result?: 'Pass' | 'fail' | 'preparation';

  // Only include students whose last-ever evaluation (unbounded by
  // from_date/to_date) is at least this many days old. Students with no
  // evaluation at all always pass this filter (they're maximally overdue).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_days_since_last_eval?: number;
}
