import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetTodayProgressQueryDto {
  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsString()
  halqa_id?: string;

  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @IsIn(['New Lesson', 'Juzh Lesson', 'Old Lesson'])
  type?: string;
}
