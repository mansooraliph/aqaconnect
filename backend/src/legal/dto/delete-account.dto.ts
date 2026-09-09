import { IsString, MinLength } from 'class-validator';

export class DeleteAccountDto {
  // Matched against username or email, same as LoginDto.
  @IsString()
  @MinLength(1)
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
