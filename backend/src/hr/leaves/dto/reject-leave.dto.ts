import { IsString, MinLength } from 'class-validator';

export class RejectLeaveDto {
  @IsString()
  @MinLength(1)
  approvalNote: string;
}
