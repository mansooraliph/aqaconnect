import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class BulkRescheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds: string[];

  @IsDateString()
  newStartDate: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;
}
