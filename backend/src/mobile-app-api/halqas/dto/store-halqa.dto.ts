import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class StoreHalqaDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  teacher_id!: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  current_class?: string;
}
