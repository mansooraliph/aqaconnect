import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';

function firstMessage(errors: ValidationError[]): string {
  for (const error of errors) {
    if (error.constraints) {
      const [message] = Object.values(error.constraints);
      if (message) {
        return message;
      }
    }
    if (error.children?.length) {
      const nested = firstMessage(error.children);
      if (nested) {
        return nested;
      }
    }
  }
  return 'Validation failed';
}

/**
 * The legacy mobile API returns `{status: 'error', message: <first validator
 * error>}` on a 422 (`$validator->errors()->first()`), not Nest's default
 * `{statusCode, message: string[], error}` shape. This pipe reproduces that
 * envelope so mobile clients see byte-identical validation responses.
 */
export class MobileValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new UnprocessableEntityException({ status: 'error', message: firstMessage(errors) }),
    });
  }
}
