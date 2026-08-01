import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  joining_date?: string;

  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female';
}
