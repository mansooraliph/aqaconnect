import { IsOptional, IsString } from 'class-validator';

export class GetUnassignedStudentsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  per_page?: string;

  @IsOptional()
  @IsString()
  page?: string;
}
