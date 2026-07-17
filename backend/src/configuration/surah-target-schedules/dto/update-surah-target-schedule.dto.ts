import { PartialType } from '@nestjs/mapped-types';
import { CreateSurahTargetScheduleDto } from './create-surah-target-schedule.dto';

export class UpdateSurahTargetScheduleDto extends PartialType(CreateSurahTargetScheduleDto) {}
