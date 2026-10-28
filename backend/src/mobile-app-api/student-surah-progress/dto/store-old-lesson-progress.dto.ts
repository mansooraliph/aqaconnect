import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StoreOldLessonProgressDto {
  @IsString()
  student_id!: string;

  @IsIn(['Old Lesson', 'Juzh Lesson'])
  type!: 'Old Lesson' | 'Juzh Lesson';

  @IsString()
  completed_at!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  surah_from?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  surah_from_ayah?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  surah_to?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  surah_to_ayah?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  juzuh_from?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  juzuh_to?: number;

  // Stage 4 revision marking — pages read past the end of juzuh_to (e.g.
  // "1 Juz' + 8 extra pages" instead of a round number of Juz'). Only
  // meaningful alongside juzuh_from/juzuh_to; ignored otherwise.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(604)
  extra_pages?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(604)
  page_from?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(604)
  page_to?: number;

  // "Total Pages Read" method — a plain count, independent of page_from/
  // page_to (which record an actual page range).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(604)
  page_count?: number;

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
