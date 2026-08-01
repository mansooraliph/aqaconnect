import { IsIn, IsOptional, IsString } from 'class-validator';

export class ClassSectionYearsQueryDto {
  @IsOptional()
  @IsString()
  academic_year_id?: string;

  @IsOptional()
  @IsString()
  class_id?: string;

  @IsOptional()
  @IsString()
  section_id?: string;

  @IsOptional()
  @IsString()
  teacher_id?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  search?: string;
}
