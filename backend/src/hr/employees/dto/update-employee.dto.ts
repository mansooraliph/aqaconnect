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

  // Admin-initiated reset — sets the employee's login password directly,
  // no current-password confirmation (that's the self-service change-password
  // flow, which doesn't exist yet for this portal).
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;
}
