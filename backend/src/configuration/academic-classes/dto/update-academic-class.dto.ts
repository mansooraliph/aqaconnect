import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateAcademicClassDto } from './create-academic-class.dto';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateAcademicClassDto extends PartialType(CreateAcademicClassDto) {
  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
