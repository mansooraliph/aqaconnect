import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MobileRejectLeaveDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejection_reason?: string;
}
