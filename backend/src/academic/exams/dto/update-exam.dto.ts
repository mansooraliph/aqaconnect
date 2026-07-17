import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { ActiveStatusDto } from '../../../common/dto/active-status.dto';

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsDateString()
  examDate?: string;

  @IsOptional()
  @IsNumber()
  maxMarks?: number;

  @IsOptional()
  @IsEnum(ActiveStatusDto)
  status?: ActiveStatusDto;
}
