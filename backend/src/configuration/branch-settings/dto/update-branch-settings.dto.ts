import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateBranchSettingsDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  // Day-of-week numbers this branch treats as its weekend (0 = Sunday ... 6 = Saturday).
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekendDays?: number[];
}
