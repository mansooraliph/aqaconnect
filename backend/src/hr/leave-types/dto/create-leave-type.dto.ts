import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  /** Annual quota (days) auto-assigned to new employees and used as the bulk-assign default. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDays?: number;
}
