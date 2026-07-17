import { IsInt, IsOptional } from 'class-validator';

export class UpdateClassSectionDto {
  @IsOptional()
  @IsInt()
  capacity?: number;
}
