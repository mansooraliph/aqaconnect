import { IsString } from 'class-validator';

export class TransferEnrollmentDto {
  @IsString()
  toAcademicClassSectionYearId: string;
}
