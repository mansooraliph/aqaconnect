import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum PaymentModeDto {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  ONLINE = 'ONLINE',
  CARD = 'CARD',
}

export class CreatePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsEnum(PaymentModeDto)
  mode: PaymentModeDto;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  proofFileUrl?: string;

  // Cheque/bank-transfer payments can be recorded as pending clearance —
  // no allocation/receipt happens until POST /payments/:id/confirm. Instant
  // modes (cash/card/online) default to immediate completion.
  @IsOptional()
  @IsEnum(['PENDING', 'COMPLETED'])
  status?: 'PENDING' | 'COMPLETED';
}
