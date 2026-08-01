import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class BulkMarkCompletedDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ayah_ids!: string[];

  @IsOptional()
  @IsIn(['Very Good', 'Good', 'Average', 'Bad'])
  grade?: 'Very Good' | 'Good' | 'Average' | 'Bad';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  // Accepted for legacy request-shape compatibility; no file-storage
  // subsystem in this schema, so nothing is actually persisted/uploaded.
  @IsOptional()
  remark_file?: unknown;

  @IsOptional()
  @IsString()
  completed_at?: string;
}
