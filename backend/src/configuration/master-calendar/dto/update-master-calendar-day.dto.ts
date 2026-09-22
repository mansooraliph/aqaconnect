import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateMasterCalendarDayDto {
  @IsOptional()
  @IsBoolean()
  isWorkingDay?: boolean;

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
