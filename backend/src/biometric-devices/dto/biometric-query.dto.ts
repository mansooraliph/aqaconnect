import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class PageQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  per_page?: string;
}

export class ListTransactionsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  punchState?: number;

  @IsOptional()
  @IsString()
  deviceSn?: string;

  @IsOptional()
  @IsIn(['STUDENT', 'TEACHER', 'STAFF'])
  userType?: string;
}

export class ListEnrollmentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['FP', 'FACE', 'PALM', 'USERPIC', 'BIOPHOTO'])
  type?: string;

  @IsOptional()
  @IsString()
  userCode?: string;

  @IsOptional()
  @IsIn(['STUDENT', 'TEACHER', 'STAFF'])
  userType?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class UpdateAliasDto {
  @IsString()
  alias: string;
}
