import { IsOptional, IsString } from 'class-validator';

export class ApproveLeaveDto {
  @IsOptional()
  @IsString()
  approvalNote?: string;
}
