import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { ToArray } from '../../common/to-array.transform';

export class GetTopStudentsQueryDto {
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
  @IsIn(['New Lesson', 'Juzh Lesson', 'Old Lesson'], { each: true })
  types?: string[];

  @IsOptional()
  @IsString()
  limit?: string;
}
