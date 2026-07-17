import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateFeeStructureDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
