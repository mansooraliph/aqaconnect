import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AddStudentEventDto {
  @IsString()
  student_id!: string;

  @IsString()
  event_date!: string;

  @IsString()
  @MaxLength(255)
  event_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
