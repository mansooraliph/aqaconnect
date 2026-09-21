import { IsOptional, IsString } from 'class-validator';

export class GetAttendanceReportQueryDto {
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
}
