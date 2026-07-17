import { IsString } from 'class-validator';

export class GenerateCalendarDaysDto {
  @IsString()
  academicYearId: string;
}
