import { IsString } from 'class-validator';

export class CreateStudentLessonProgressDto {
  @IsString()
  studentId: string;

  @IsString()
  lessonId: string;
}
