import { IsIn } from 'class-validator';

export class ReorderLessonStageDto {
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}
