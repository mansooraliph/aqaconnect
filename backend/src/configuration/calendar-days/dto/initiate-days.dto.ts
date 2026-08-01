import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKEND_PATTERNS = ['1st', '2nd', '3rd', '4th', 'last'];

export class InitiateDaysDto {
  @IsInt()
  @Min(1900)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsArray()
  @IsIn(WEEKDAYS, { each: true })
  selectedWeekdays?: string[];

  @IsOptional()
  @IsIn(['all', 'specific'])
  weekendOption?: 'all' | 'specific';

  @IsOptional()
  @IsArray()
  @IsIn(WEEKEND_PATTERNS, { each: true })
  selectedWeekends?: string[];

  @IsOptional()
  @IsString()
  holidayName?: string;

  @IsOptional()
  @IsBoolean()
  includeIslamicHolidays?: boolean;
}
