import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

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
}

export class RejectAdmissionDto {
  @IsString()
  reviewNote: string;
}
