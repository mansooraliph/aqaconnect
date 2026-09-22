import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PublishMasterCalendarDto {
  @IsInt()
  @Min(1900)
  @Max(2100)
  year: number;

  /** Omit to publish to every active branch. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}
