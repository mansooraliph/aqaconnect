import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class SurahTargetItemDto {
  @IsInt()
  @Min(1)
  dayNumber: number;

  @IsInt()
  @Min(1)
  fromAyah: number;

  @IsInt()
  @Min(1)
  toAyah: number;
}

export class UpsertSurahTargetsDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => SurahTargetItemDto)
  targets: SurahTargetItemDto[];
}
