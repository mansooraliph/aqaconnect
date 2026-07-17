import { IsString } from 'class-validator';

export class AssignStudentDto {
  @IsString()
  studentId: string;
}
