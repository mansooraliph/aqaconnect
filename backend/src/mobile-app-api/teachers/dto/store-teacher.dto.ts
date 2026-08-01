import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class StoreTeacherDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(255)
  username!: string;

  @IsString()
  @MaxLength(20)
  mobile!: string;

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
