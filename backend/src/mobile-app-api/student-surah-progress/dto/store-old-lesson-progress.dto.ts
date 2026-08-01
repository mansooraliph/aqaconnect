import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StoreOldLessonProgressDto {
  @IsString()
  student_id!: string;

  @IsIn(['Old Lesson', 'Juzh Lesson'])
  type!: 'Old Lesson' | 'Juzh Lesson';

  @IsString()
  completed_at!: string;

  @IsOptional()
  @IsInt()
  surah_from?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  surah_from_ayah?: number;

  @IsOptional()
  @IsInt()
  surah_to?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  surah_to_ayah?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  juzuh_from?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  juzuh_to?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(604)
  page_from?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(604)
  page_to?: number;

  @IsOptional()
  @IsIn(['Very Good', 'Good', 'Average', 'Bad'])
  grade?: 'Very Good' | 'Good' | 'Average' | 'Bad';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @IsOptional()
  remark_file?: unknown;
}
