import { IsIn, IsOptional } from 'class-validator';

/** Shared by getSurahDetails/getSurahProgressList/getCompletedSurahList/getPendingSurahList. */
export class TypeFilterQueryDto {
  @IsOptional()
  @IsIn(['New Lesson', 'Juzh Lesson', 'Old Lesson'])
  type?: 'New Lesson' | 'Juzh Lesson' | 'Old Lesson';
}
