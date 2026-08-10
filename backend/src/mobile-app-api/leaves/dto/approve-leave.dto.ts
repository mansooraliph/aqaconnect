import { IsString, MinLength } from 'class-validator';

export class MobileApproveLeaveDto {
  @IsString()
  @MinLength(1)
  leave_id: string;
}
