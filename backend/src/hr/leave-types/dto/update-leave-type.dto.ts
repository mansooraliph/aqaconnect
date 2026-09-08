import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateLeaveTypeDto } from './create-leave-type.dto';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) {
  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
