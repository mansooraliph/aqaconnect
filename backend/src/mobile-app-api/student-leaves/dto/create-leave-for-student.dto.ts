import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeaveForStudentDto {
  @IsString()
  student_id!: string;

  @IsString()
  from_date!: string;

  @IsString()
  to_date!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsIn(['home', 'hostal'])
  leave_type?: 'home' | 'hostal';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  creation_remarks?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}
