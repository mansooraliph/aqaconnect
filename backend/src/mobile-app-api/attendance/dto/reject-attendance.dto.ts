import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectAttendanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejection_reason?: string;
}
