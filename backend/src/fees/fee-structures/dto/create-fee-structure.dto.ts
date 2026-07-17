import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export enum FeeFrequencyDto {
  ONE_TIME = 'ONE_TIME',
  INSTALLMENTS = 'INSTALLMENTS',
}

export class CreateFeeStructureDto {
  @IsString()
  academicClassId: string;

  @IsString()
  academicYearId: string;

  @IsString()
  feeTypeId: string;

  @IsString()
  @MinLength(1)
  name: string;

  // Authoring-time convenience field. Only meaningful (and required) when
  // frequency is ONE_TIME — see FeeStructuresService.create for why.
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsEnum(FeeFrequencyDto)
  frequency?: FeeFrequencyDto;

  // Required when frequency is ONE_TIME (validated in the service, not here,
  // since the requirement is conditional on another field).
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
