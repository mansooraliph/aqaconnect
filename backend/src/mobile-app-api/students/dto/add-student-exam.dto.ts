import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AddStudentExamDto {
  @IsString()
  student_id!: string;

  @IsString()
  exam_date!: string;

  @IsOptional()
  @IsString()
  exam_id?: string;

  @IsOptional()
  @IsIn(['Pass', 'fail', 'preparation'])
  result?: 'Pass' | 'fail' | 'preparation';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  marks?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsOptional()
  @IsString()
  schedule_id?: string;
}
