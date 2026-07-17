import { IsIn } from 'class-validator';

export class ReorderLessonSubStageDto {
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}
