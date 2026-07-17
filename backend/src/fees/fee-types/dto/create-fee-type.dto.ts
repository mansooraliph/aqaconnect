import { IsString, MinLength } from 'class-validator';

export class CreateFeeTypeDto {
  @IsString()
  @MinLength(1)
  name: string;
}
