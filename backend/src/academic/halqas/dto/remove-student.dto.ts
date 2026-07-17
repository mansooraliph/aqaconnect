import { IsString } from 'class-validator';

export class RemoveStudentDto {
  @IsString()
  studentId: string;
}
