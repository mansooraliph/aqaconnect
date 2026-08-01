import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class BulkMarkSurahsCompletedDto {
  @IsString()
  student_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  surah_ids!: string[];

  @IsOptional()
  @IsIn(['New Lesson', 'Juzh Lesson', 'Old Lesson'])
  type?: 'New Lesson' | 'Juzh Lesson' | 'Old Lesson';

  @IsOptional()
  @IsIn(['Very Good', 'Good', 'Average', 'Bad'])
  grade?: 'Very Good' | 'Good' | 'Average' | 'Bad';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @IsOptional()
  remark_file?: unknown;

  @IsOptional()
  @IsString()
  completed_at?: string;
}
