import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { EmployeeType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  username: string;

  // Drives whether a linked Teacher record (same login) is auto-provisioned —
  // see EmployeesService.create. Defaults to OFFICE_STAFF when omitted.
  @IsOptional()
  @IsEnum(EmployeeType)
  employeeType?: EmployeeType;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(1)
  password: string;

  // Single display name, split into firstName/lastName at the User record
  // level, which has no single-name column.
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  // Auto-generated (next EMP### for the branch) when omitted.
  @IsOptional()
  @IsString()
  @MinLength(1)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  designationId?: string;

  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;
}
