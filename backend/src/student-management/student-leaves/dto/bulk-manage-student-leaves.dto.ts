import { ArrayMinSize, IsArray, IsIn, IsString, MinLength, ValidateIf } from 'class-validator';

export type BulkManageAction = 'approve' | 'reject';

export class BulkManageStudentLeavesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];

  @IsIn(['approve', 'reject'])
  action: BulkManageAction;

  @ValidateIf((o: BulkManageStudentLeavesDto) => o.action === 'reject')
  @IsString()
  @MinLength(1)
  approvalRemarks?: string;
}
