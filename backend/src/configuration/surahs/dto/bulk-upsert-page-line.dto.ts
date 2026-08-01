import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class SurahAyahPageLineItemDto {
  @IsString()
  @MinLength(1)
  surahId: string;

  @IsInt()
  @Min(1)
  ayahNumber: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  juzNumber?: number;

  @IsString()
  @MinLength(1)
  quranPageId: string;

  @IsInt()
  @Min(1)
  lineFrom: number;

  @IsInt()
  @Min(1)
  lineTo: number;
}

export class BulkUpsertPageLineDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SurahAyahPageLineItemDto)
  items: SurahAyahPageLineItemDto[];
}
