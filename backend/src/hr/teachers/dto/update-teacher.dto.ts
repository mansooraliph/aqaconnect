import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
