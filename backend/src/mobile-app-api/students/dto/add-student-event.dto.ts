import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AddStudentEventDto {
  @IsString()
  student_id!: string;

  @IsString()
  event_date!: string;

  @IsOptional()
  @IsString()
  event_date_to?: string;

  @IsString()
  @MaxLength(255)
  event_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
