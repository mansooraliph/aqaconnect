import { IsIn } from 'class-validator';

export class MarkStudentLessonProgressDto {
  @IsIn(['IN_PROGRESS', 'COMPLETED'])
  status: 'IN_PROGRESS' | 'COMPLETED';
}
