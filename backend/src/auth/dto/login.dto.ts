import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Matched against username or email — the login form doesn't force users
  // to remember which identifier they were assigned.
  @IsString()
  @MinLength(1)
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
