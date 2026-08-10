import { IsString, MinLength } from 'class-validator';

export class MobileCancelLeaveDto {
  @IsString()
  @MinLength(1)
  leave_id: string;
}
