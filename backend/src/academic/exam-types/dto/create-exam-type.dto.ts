import { IsString, MinLength } from 'class-validator';

export class CreateExamTypeDto {
  @IsString()
  @MinLength(1)
  name: string;
}
