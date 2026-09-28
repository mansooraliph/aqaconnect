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

export class AddStudentExamDto {
  @IsString()
  student_id!: string;

  @IsString()
  exam_date!: string;

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

  // 'exam' = a plain evaluation; 'mukammal' = a comprehensive, multi-Juz'
  // completion assessment. Defaults to 'exam' on the service side when
  // omitted, same as legacy records that predate this field.
  @IsOptional()
  @IsIn(['exam', 'mukammal'])
  exam_mode?: 'exam' | 'mukammal';

  // Which Juz' (1-30) this evaluation covered — applies to either mode.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(30, { each: true })
  juz_numbers?: number[];
}
