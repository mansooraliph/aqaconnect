import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class AssignStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  student_ids!: string[];

  @IsString()
  halqa_id!: string;

  // When true, each student's current active halqa (if any) is remembered
  // as their restore target instead of being discarded — see restoreStudents.
  @IsOptional()
  @IsBoolean()
  is_temporary?: boolean;
}
