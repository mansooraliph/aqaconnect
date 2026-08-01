import { IsOptional, IsString } from 'class-validator';

export class AdmissionYearReportQueryDto {
  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  class_id?: string;

  @IsOptional()
  @IsString()
  academic_year_id?: string;
}
