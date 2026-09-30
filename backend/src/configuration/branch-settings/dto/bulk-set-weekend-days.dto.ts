import { ArrayMinSize, IsArray, IsInt, IsString, Max, Min } from 'class-validator';

export class BulkSetWeekendDaysDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  branchIds: string[];

  // Day-of-week numbers (0 = Sunday ... 6 = Saturday) applied to every branch in branchIds.
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekendDays: number[];
}
