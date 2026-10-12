import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { ToArray } from '../../common/to-array.transform';

export class GetFullProgressReportQueryDto {
  @IsString()
  from_date!: string;

  @IsString()
  to_date!: string;

  @IsOptional()
  @IsString()
  halqa_id?: string;

  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @ToArray()
  @IsArray()
  // 'Evaluation' isn't a ProgressEntryType (it's a StudentExam day, not a
  // lesson) — the service layer splits it out from the lesson-type labels
  // before touching TYPE_TO_ENUM, see getFullProgressReport.
  @IsIn(['New Lesson', 'Juzh Lesson', 'Old Lesson', 'Evaluation'], { each: true })
  types?: string[];
}
