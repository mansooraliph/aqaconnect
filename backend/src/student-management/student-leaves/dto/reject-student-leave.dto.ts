import { IsString, MinLength } from 'class-validator';

export class RejectStudentLeaveDto {
  @IsString()
  @MinLength(1)
  approvalRemarks: string;
}
