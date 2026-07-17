import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateLessonStageDto } from './create-lesson-stage.dto';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateLessonStageDto extends PartialType(CreateLessonStageDto) {
  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
