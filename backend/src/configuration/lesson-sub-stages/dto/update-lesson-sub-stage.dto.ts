import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateLessonSubStageDto } from './create-lesson-sub-stage.dto';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateLessonSubStageDto extends PartialType(CreateLessonSubStageDto) {
  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
