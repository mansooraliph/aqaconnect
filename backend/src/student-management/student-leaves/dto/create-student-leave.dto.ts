import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStudentLeaveDto {
  @IsString()
  @MinLength(1)
  studentId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @MinLength(1)
  reason: string;

  @IsOptional()
  @IsString()
  leaveType?: string;

  @IsOptional()
  @IsString()
  creationRemarks?: string;
}
