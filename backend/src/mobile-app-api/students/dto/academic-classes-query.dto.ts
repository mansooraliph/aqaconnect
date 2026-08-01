import { IsOptional, IsString } from 'class-validator';

export class AcademicClassesQueryDto {
  @IsOptional()
  @IsString()
  academic_year_id?: string;
}
