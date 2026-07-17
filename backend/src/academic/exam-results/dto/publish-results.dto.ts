import { IsArray, IsOptional, IsString } from 'class-validator';

export class PublishResultsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];
}
