import { IsArray, IsOptional, IsString } from 'class-validator';

export class PublishMasterAcademicYearDto {
  /** Omit to publish to every active branch. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}
