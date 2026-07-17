import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export enum DiscountAllocationTypeDto {
  DISCOUNT = 'DISCOUNT',
  WAIVER = 'WAIVER',
}

export class CreateDiscountDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(1)
  reason: string;

  @IsOptional()
  @IsEnum(DiscountAllocationTypeDto)
  type?: DiscountAllocationTypeDto;
}
