import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class ApproveAdmissionDto {
  @IsString()
  @MinLength(1)
  studentCode: string;

  @IsOptional()
  @IsString()
  reviewNote?: string;

  // Student.userId is nullable — most admissions don't need a portal login
  // (guardian-managed only, per the schema's own comment on Student). Only
  // provision one when explicitly requested; the password is always
  // auto-generated server-side (see AdmissionsService.approve), never
  // client-supplied, matching the same pattern as Teacher Application
  // approval.
  @IsOptional()
  @IsBoolean()
  createLogin?: boolean;

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

export class RejectAdmissionDto {
  @IsString()
  reviewNote: string;
}
