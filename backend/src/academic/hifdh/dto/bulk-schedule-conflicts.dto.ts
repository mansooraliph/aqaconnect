import { ArrayMinSize, IsArray, IsDateString, IsString } from 'class-validator';

export class BulkScheduleConflictsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  branchIds: string[];

  @IsArray()
  @IsDateString({}, { each: true })
  @ArrayMinSize(1)
  dates: string[];
}
