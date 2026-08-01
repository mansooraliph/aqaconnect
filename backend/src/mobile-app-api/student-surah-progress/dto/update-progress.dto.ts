import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProgressDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  progress_ids!: string[];

  @IsOptional()
  @IsIn(['Very Good', 'Good', 'Average', 'Bad'])
  grade?: 'Very Good' | 'Good' | 'Average' | 'Bad';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @IsOptional()
  @IsString()
  completed_at?: string;

  @IsOptional()
  remark_file?: unknown;

  @IsOptional()
  @IsBoolean()
  unmark?: boolean;
}
