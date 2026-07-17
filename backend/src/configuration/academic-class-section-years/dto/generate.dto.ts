import { IsString } from 'class-validator';

export class GenerateClassSectionYearsDto {
  @IsString()
  academicYearId: string;
}
