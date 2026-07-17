import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { ActiveStatus } from '@prisma/client';

export class CreateSurahTargetScheduleDto {
  @IsString()
  surahId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsInt()
  targetsPerDay?: number;

  @IsOptional()
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;
}
