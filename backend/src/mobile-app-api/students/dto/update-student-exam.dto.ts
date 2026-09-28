import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateStudentExamDto {
  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @IsString()
  exam_date?: string;

  @IsOptional()
  @IsString()
  exam_id?: string;

  @IsOptional()
  @IsIn(['Pass', 'fail', 'preparation'])
  result?: 'Pass' | 'fail' | 'preparation';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  marks?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsOptional()
  @IsString()
  schedule_id?: string;

  @IsOptional()
  @IsIn(['exam', 'mukammal'])
  exam_mode?: 'exam' | 'mukammal';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(30, { each: true })
  juz_numbers?: number[];
}
