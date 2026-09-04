import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetFullProgressReportQueryDto } from './get-full-progress-report-query.dto';

describe('GetFullProgressReportQueryDto', () => {
  const base = { from_date: '2026-01-01', to_date: '2026-01-31' };

  it('accepts a single types value as a plain query string', async () => {
    const instance = plainToInstance(GetFullProgressReportQueryDto, { ...base, types: 'New Lesson' });
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
    expect(instance.types).toEqual(['New Lesson']);
  });

  it('accepts repeated types values already parsed as an array', async () => {
    const instance = plainToInstance(GetFullProgressReportQueryDto, {
      ...base,
      types: ['New Lesson', 'Old Lesson'],
    });
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
    expect(instance.types).toEqual(['New Lesson', 'Old Lesson']);
  });

  it('allows types to be omitted', async () => {
    const instance = plainToInstance(GetFullProgressReportQueryDto, { ...base });
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
    expect(instance.types).toBeUndefined();
  });

  it('rejects an invalid type value', async () => {
    const instance = plainToInstance(GetFullProgressReportQueryDto, { ...base, types: 'Bogus' });
    const errors = await validate(instance);
    expect(errors).toHaveLength(1);
  });
});
