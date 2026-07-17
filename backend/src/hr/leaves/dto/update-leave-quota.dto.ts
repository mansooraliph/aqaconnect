import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateLeaveQuotaDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usedDays?: number;
}
