import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStudentEventDto {
  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @IsString()
  event_date?: string;

  @IsOptional()
  @IsString()
  event_date_to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  event_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
