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

  // The actual uploaded file is read via @UploadedFile() in the controller,
  // not through this DTO field — it only needs to exist so class-validator's
  // whitelist doesn't reject the multipart field.
  @IsOptional()
  remark_file?: unknown;

  @IsOptional()
  @IsString()
  completed_at?: string;
}
