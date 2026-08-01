import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class BulkReviewLeavesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  leave_ids!: string[];

  @IsIn(['approved', 'rejected'])
  action!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  approval_remarks?: string;
}
