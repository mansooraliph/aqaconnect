import { IsOptional, IsString } from 'class-validator';

export class ApproveStudentLeaveDto {
  @IsOptional()
  @IsString()
  approvalRemarks?: string;
}
