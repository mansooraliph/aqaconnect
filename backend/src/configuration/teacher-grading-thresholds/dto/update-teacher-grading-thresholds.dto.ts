import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateTeacherGradingThresholdsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  excellentMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  goodMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  averageMin?: number;
}
