import { IsOptional, IsString } from 'class-validator';

/** Shared shape for getStudentsExceededTarget (all optional) and studentsWithPendingTargets (from_date/to_date required, enforced in the controller/service, not here, since the two legacy endpoints share this exact field set). */
export class GetStudentsTargetQueryDto {
  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsString()
  halqa_id?: string;

  // No `type` field — Target Overview only ever compares against the New
  // Lesson schedule (there's no Old/Juzh Lesson schedule concept at all),
  // so a type filter here could only ever produce a meaningless
  // comparison. See targetAndActualAyahsBatch's doc comment.

  @IsOptional()
  @IsString()
  min_excess?: string;

  @IsOptional()
  @IsString()
  min_deficit?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
