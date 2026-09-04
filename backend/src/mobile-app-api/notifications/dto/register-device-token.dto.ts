import { IsIn, IsOptional, IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;
}
