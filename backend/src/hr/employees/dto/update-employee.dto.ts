import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  designationId?: string;

  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
