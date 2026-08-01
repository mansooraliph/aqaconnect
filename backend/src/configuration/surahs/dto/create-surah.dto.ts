import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { RevelationType } from '@prisma/client';

export class CreateSurahDto {
  @IsInt()
  @Min(1)
  @Max(114)
  number: number;

  @IsString()
  @MinLength(1)
  nameArabic: string;

  @IsString()
  @MinLength(1)
  nameEnglish: string;

  @IsInt()
  @Min(1)
  totalAyahs: number;

  @IsOptional()
  @IsInt()
  juzFrom?: number;

  @IsOptional()
  @IsInt()
  juzTo?: number;

  @IsOptional()
  @IsInt()
  pageNumberFrom?: number;

  @IsOptional()
  @IsInt()
  pageNumberTo?: number;

  @IsOptional()
  @IsInt()
  lineNumberFrom?: number;

  @IsOptional()
  @IsInt()
  lineNumberTo?: number;

  @IsOptional()
  @IsEnum(RevelationType)
  revelationType?: RevelationType;
}
