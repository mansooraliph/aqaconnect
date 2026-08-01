import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { DifficultyLevel, SchedulePriority, ScheduleStage } from '@prisma/client';

export class CreateSurahTargetScheduleDto {
  @IsInt()
  @Min(1)
  dayNumber: number;

  @IsOptional()
  @IsEnum(ScheduleStage)
  stage?: ScheduleStage;

  @IsOptional()
  @IsString()
  surahId?: string;

  @IsOptional()
  @IsInt()
  pageNumberFrom?: number;

  @IsOptional()
  @IsInt()
  pageNumberTo?: number;

  @IsOptional()
  @IsInt()
  lineFrom?: number;

  @IsOptional()
  @IsInt()
  lineTo?: number;

  @IsOptional()
  @IsString()
  portionDescription?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  fromAyah?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  toAyah?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficultyLevel?: DifficultyLevel;

  @IsOptional()
  @IsEnum(SchedulePriority)
  priority?: SchedulePriority;

  @IsOptional()
  @IsString()
  scheduleType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  examName?: string;
}
