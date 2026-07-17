import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  studentCode: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

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
}
