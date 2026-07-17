import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum EnrollmentStatusDto {
  ACTIVE = 'ACTIVE',
  TRANSFERRED = 'TRANSFERRED',
  WITHDRAWN = 'WITHDRAWN',
  COMPLETED = 'COMPLETED',
}

export class QueryEnrollmentDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  academicClassSectionYearId?: string;

  @IsOptional()
  @IsEnum(EnrollmentStatusDto)
  status?: EnrollmentStatusDto;
}
