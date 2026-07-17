import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAwardDto {
  @IsString()
  employeeId: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
