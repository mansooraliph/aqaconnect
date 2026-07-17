import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class BulkEntryResultItemDto {
  @IsString()
  studentId: string;

  @IsNumber()
  marksObtained: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class BulkEntryResultsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkEntryResultItemDto)
  results: BulkEntryResultItemDto[];
}
