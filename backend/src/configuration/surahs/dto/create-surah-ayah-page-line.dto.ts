import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateSurahAyahPageLineDto {
  @IsString()
  @MinLength(1)
  surahId: string;

  @IsInt()
  @Min(1)
  ayahNumber: number;

  @IsInt()
  @Min(1)
  pageNumber: number;

  @IsInt()
  @Min(1)
  lineFrom: number;

  @IsInt()
  @Min(1)
  lineTo: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  juzNumber?: number;
}
