import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateClassSectionDto {
  @IsString()
  academicClassId: string;

  @IsString()
  academicSectionId: string;

  @IsOptional()
  @IsInt()
  capacity?: number;
}
