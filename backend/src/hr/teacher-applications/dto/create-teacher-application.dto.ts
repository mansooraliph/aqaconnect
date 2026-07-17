import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTeacherApplicationDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  coverNote?: string;
}
