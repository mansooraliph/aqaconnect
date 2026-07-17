import { IsEnum, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateFeeTypeDto } from './create-fee-type.dto';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateFeeTypeDto extends PartialType(CreateFeeTypeDto) {
  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
