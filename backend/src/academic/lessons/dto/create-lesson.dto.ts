import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  lessonStageId: string;

  @IsOptional()
  @IsString()
  lessonSubStageId?: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
