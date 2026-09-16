import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class RestoreStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  student_ids!: string[];
}
