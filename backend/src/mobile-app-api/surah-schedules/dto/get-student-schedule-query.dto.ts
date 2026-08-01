import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetStudentScheduleQueryDto {
  @IsOptional()
  @IsString()
  schedule_no?: string;

  @IsOptional()
  @IsString()
  surah_number?: string;

  @IsOptional()
  @IsIn(['all', 'pending', 'in_progress', 'completed', 'needs_review', 'overdue', 'today', 'upcoming'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  per_page?: string;
}
