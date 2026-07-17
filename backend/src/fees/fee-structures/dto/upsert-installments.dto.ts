import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class InstallmentItemDto {
  @IsInt()
  @Min(1)
  sequenceNo: number;

  @IsString()
  @MinLength(1)
  name: string;

  @IsNumber()
  amount: number;

  @IsDateString()
  dueDate: string;
}

export class UpsertInstallmentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InstallmentItemDto)
  installments: InstallmentItemDto[];
}
