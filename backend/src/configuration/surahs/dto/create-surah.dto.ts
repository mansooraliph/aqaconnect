import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

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
  @IsString()
  revelationType?: string;
}
