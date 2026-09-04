import { IsOptional, IsString } from 'class-validator';

export class ActivityQueryDto {
  // Required for Teacher/Admin callers (viewing another student); ignored/
  // overridden for Student callers, who are always resolved to their own
  // linked Student record — see StudentsController.resolveActivityReportStudentId.
  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;
}
