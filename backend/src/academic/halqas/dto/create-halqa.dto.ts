import { IsOptional, IsString } from 'class-validator';

export class CreateHalqaDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  teacherId?: string;
}
