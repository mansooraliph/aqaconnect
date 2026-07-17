import { IsNumber, IsOptional } from 'class-validator';

// No employeeId here: clock-in is always self-service, resolved server-side
// from the caller's own Employee record (see AttendanceService.clockIn).
export class ClockInDto {
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
