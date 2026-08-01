import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetStudentSurahProgressQueryDto {
  @IsOptional()
  @IsString()
  surah_id?: string;

  @IsOptional()
  @IsIn(['New Lesson', 'Juzh Lesson', 'Old Lesson'])
  type?: 'New Lesson' | 'Juzh Lesson' | 'Old Lesson';
}
