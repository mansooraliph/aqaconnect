import { IsOptional, IsString } from 'class-validator';

export class ListLessonSubStageQueryDto {
  @IsOptional()
  @IsString()
  lessonStageId?: string;
}
