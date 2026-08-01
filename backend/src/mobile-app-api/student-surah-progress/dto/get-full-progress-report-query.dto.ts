import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class GetFullProgressReportQueryDto {
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

  @IsOptional()
  @IsArray()
  @IsIn(['New Lesson', 'Juzh Lesson', 'Old Lesson'], { each: true })
  types?: string[];
}
