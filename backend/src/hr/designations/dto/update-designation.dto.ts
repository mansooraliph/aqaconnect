import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateDesignationDto } from './create-designation.dto';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateDesignationDto extends PartialType(CreateDesignationDto) {
  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
