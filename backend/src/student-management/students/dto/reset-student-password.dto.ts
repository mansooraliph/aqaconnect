import { IsString, MinLength } from 'class-validator';

export class ResetStudentPasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}
