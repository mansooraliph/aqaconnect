import { IsOptional, IsString } from 'class-validator';

export class ActivityQueryDto {
  @IsString()
  student_id!: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;
}
