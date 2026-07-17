import { IsOptional, IsString } from 'class-validator';

export class ChangeParentDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
