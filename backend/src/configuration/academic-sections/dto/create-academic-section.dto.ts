import { IsString, MinLength } from 'class-validator';

export class CreateAcademicSectionDto {
  @IsString()
  @MinLength(1)
  name: string;
}
