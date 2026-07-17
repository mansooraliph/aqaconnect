import { IsDateString, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateExamDto {
  @IsString()
  examTypeId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsDateString()
  examDate: string;

  @IsOptional()
  @IsNumber()
  maxMarks?: number;
}
