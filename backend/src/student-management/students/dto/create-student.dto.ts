import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  studentCode: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  // Student.userId is nullable — most students are guardian-managed with no
  // portal account of their own (per the schema's design). Only provision a
  // login when explicitly requested; the password is always auto-generated
  // server-side (see StudentsService.create), never client-supplied,
  // matching AdmissionsService.approve's pattern.
  @IsOptional()
  @IsBoolean()
  createLogin?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Required (validated in the service) when createLogin is true — login is
  // now username-based, not email-based.
  @IsOptional()
  @IsString()
  username?: string;

  // When provided, auto-generates this student's initial Hifdh schedule from
  // the HIFDH-stage SurahTargetSchedule rows, matching legacy's
  // createInitialHifdhSchedules trigger (see HifdhService).
  @IsOptional()
  @IsString()
  halqaId?: string;

  @IsOptional()
  @IsDateString()
  hifdhStartDate?: string;
}
