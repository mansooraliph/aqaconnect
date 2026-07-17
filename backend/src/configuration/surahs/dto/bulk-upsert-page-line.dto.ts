import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class SurahAyahPageLineItemDto {
  @IsString()
  @MinLength(1)
  surahId: string;

  @IsInt()
  @Min(1)
  ayahNumber: number;

  @IsString()
  @MinLength(1)
  quranPageId: string;

  @IsInt()
  @Min(1)
  lineNumber: number;
}

export class BulkUpsertPageLineDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SurahAyahPageLineItemDto)
  items: SurahAyahPageLineItemDto[];
}
