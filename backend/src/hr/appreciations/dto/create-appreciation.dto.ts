import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAppreciationDto {
  @IsString()
  employeeId: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  note?: string;
}
