import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetLeavesQueryDto {
  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(['home', 'hostal'])
  leave_type?: 'home' | 'hostal';

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsString()
  per_page?: string;
}
