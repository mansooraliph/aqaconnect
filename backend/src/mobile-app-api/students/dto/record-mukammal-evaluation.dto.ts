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

// Recording an evaluation from the Mukammal queue is a real, independent
// assessment by the Admin/Principal — not a rubber-stamp — so unlike the
// general exam create/update DTOs, 'preparation' is not a valid result
// here: this is only ever a completed Pass/Fail call.
export class RecordMukammalEvaluationDto {
  @IsString()
  exam_date!: string;

  @IsIn(['exam', 'mukammal'])
  exam_mode!: 'exam' | 'mukammal';

  @IsIn(['Pass', 'fail'])
  result!: 'Pass' | 'fail';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  marks?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(30, { each: true })
  juz_numbers?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
