import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(20)
  mobile_1!: string;

  @IsString()
  @MaxLength(10)
  mobile_1_country_code!: string;

  @IsIn(['male', 'female'])
  gender!: 'male' | 'female';

  @IsString()
  @MaxLength(255)
  username!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  student_id?: string;

  @IsString()
  @MaxLength(255)
  father_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mother_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  guardian_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile_2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  mobile_2_country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  whatsapp_country_code?: string;

  @IsOptional()
  @IsString()
  joining_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  blood_group?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  hifdh_start_date?: string;

  @IsOptional()
  @IsString()
  halqa_id?: string;

  @IsOptional()
  @IsIn(['enable', 'disable'])
  login?: 'enable' | 'disable';

  @IsOptional()
  @IsBoolean()
  email_notifications?: boolean;

  // Accepted for legacy request-shape compatibility, no effect: the legacy
  // controller's own createStudentEnrollment() is an empty stub, and there
  // is no custom-fields subsystem in this schema.
  @IsOptional()
  custom_fields_data?: unknown;

  @IsOptional()
  @IsString()
  class_section_year_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  roll_no?: string;
}
