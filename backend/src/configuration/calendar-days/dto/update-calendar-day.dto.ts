import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCalendarDayDto {
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
  @IsString()
  note?: string;
}
