import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateDepartmentDto } from './create-department.dto';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
