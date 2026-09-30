import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class BulkSetCalendarDaysDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  branchIds: string[];

  @IsDateString()
  fromDate: string; // yyyy-MM-dd

  @IsDateString()
  toDate: string; // yyyy-MM-dd, inclusive; same as fromDate for a single day

  @IsOptional()
  @IsBoolean()
  isHoliday?: boolean;

  @IsOptional()
  @IsString()
  holidayName?: string;

  @IsOptional()
  @IsBoolean()
  isEvent?: boolean;

  @IsOptional()
  @IsString()
  eventName?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
