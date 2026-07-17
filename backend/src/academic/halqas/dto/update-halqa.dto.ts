import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ActiveStatus } from '@prisma/client';

export class UpdateHalqaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;
}
