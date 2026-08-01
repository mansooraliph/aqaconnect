import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

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
