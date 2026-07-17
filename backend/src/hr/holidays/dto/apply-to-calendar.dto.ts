import { IsString } from 'class-validator';

export class ApplyToCalendarDto {
  @IsString()
  academicYearId: string;
}
