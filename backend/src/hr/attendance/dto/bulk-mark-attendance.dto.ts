import { IsArray, IsDateString, IsEnum, IsString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class BulkMarkAttendanceDto {
  @IsArray()
  @IsString({ each: true })
  employeeIds: string[];

  @IsDateString()
  date: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}
