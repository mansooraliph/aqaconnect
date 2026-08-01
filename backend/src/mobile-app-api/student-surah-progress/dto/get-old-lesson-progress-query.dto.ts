import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetOldLessonProgressQueryDto {
  @IsIn(['Old Lesson', 'Juzh Lesson'])
  type!: 'Old Lesson' | 'Juzh Lesson';

  @IsOptional()
  @IsString()
  completed_at_from?: string;

  @IsOptional()
  @IsString()
  completed_at_to?: string;

  @IsOptional()
  @IsString()
  surah_from?: string;

  @IsOptional()
  @IsString()
  surah_to?: string;

  @IsOptional()
  @IsString()
  juzuh_from?: string;

  @IsOptional()
  @IsString()
  juzuh_to?: string;

  @IsOptional()
  @IsString()
  page_from?: string;

  @IsOptional()
  @IsString()
  page_to?: string;

  @IsOptional()
  @IsIn(['Very Good', 'Good', 'Average', 'Bad'])
  grade?: string;

  @IsOptional()
  @IsString()
  per_page?: string;
}
