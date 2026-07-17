import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateQuranPageDto {
  @IsInt()
  @Min(1)
  pageNumber: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lineCount?: number;
}
