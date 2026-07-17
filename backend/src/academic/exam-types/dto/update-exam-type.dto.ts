import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateExamTypeDto } from './create-exam-type.dto';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateExamTypeDto extends PartialType(CreateExamTypeDto) {
  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
