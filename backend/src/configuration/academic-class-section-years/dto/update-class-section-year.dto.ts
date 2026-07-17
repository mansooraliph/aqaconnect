import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateClassSectionYearDto {
  @IsOptional()
  @IsInt()
  capacity?: number;

  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
