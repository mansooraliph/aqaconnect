import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateAcademicSectionDto } from './create-academic-section.dto';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateAcademicSectionDto extends PartialType(CreateAcademicSectionDto) {
  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
