import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(1)
  employeeCode: string;

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
