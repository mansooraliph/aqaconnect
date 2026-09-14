import { BadRequestException } from '@nestjs/common';

/** The mobile client sends dd-MM-yyyy — JS's native `Date` string constructor would
 *  otherwise silently misread that as MM-DD-YYYY (US-style), so parse explicitly. */
export function parseDdMmYyyy(value: string, fieldName: string): Date {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) {
    throw new BadRequestException(`${fieldName} must be in dd-MM-yyyy format`);
  }
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isValid =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
  if (!isValid) {
    throw new BadRequestException(`${fieldName} is not a valid date`);
  }
  return date;
}
