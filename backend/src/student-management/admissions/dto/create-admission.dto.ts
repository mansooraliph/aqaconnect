import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdmissionDto {
  @IsString()
  @MinLength(1)
  applicantName: string;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  desiredClassId?: string;
}
