import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type BiometricType = 'fingerprint' | 'face' | 'palm';
export type EnrollUserType = 'student' | 'teacher' | 'staff';

/** Queue an arbitrary raw command to a device (manual / advanced). */
export class RunCommandDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  command: string;
}

/** Set the duplicate-punch (re-record) interval on a single device. */
export class SetDuplicatePunchDto {
  @IsInt()
  @Min(0)
  @Max(3600)
  seconds: number;
}

/** Trigger a remote enrollment on a single device. */
export class EnrollRemotelyDto {
  @IsString()
  @IsNotEmpty()
  userCode: string; // studentCode or employeeCode

  @IsIn(['fingerprint', 'face', 'palm'])
  biometricType: BiometricType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  fingerId?: number; // 0-9, default 6 (left index finger)
}

/** Base payload for any bulk device action. */
export class BulkDeviceActionDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  deviceIds: string[];
}

export class BulkSetDuplicatePunchDto extends BulkDeviceActionDto {
  @IsInt()
  @Min(0)
  @Max(3600)
  seconds: number;
}

export class BulkEnrollDto extends BulkDeviceActionDto {
  @IsString()
  @IsNotEmpty()
  userCode: string;

  @IsIn(['fingerprint', 'face', 'palm'])
  biometricType: BiometricType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  fingerId?: number;
}

export interface BulkActionResult {
  success_count: number;
  failed_count: number;
  failed_devices: string[];
  message: string;
}

/**
 * Update the per-branch device PIN prefixes. Validated in the service. A
 * prefix value of null (or omission) clears/keeps that type's prefix — see
 * sanitizePrefixes in common/biometric/user-code.util.
 */
export class UpdateDeviceSettingsDto {
  @IsObject()
  prefixes: Record<string, string | null>;
}

export class ListEnrollUsersQueryDto {
  @IsIn(['student', 'teacher', 'staff'])
  type: EnrollUserType;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Enroll a chosen user (of any type) onto one or more devices. The server
 * queues an add-user command plus the biometric enroll command on each
 * device and records a pending enrollment.
 */
export class EnrollUserDto {
  @IsIn(['student', 'teacher', 'staff'])
  userType: EnrollUserType;

  @IsString()
  userId: string; // entity id of the student / employee

  @IsIn(['fingerprint', 'face', 'palm'])
  biometricType: BiometricType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  fingerId?: number;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  deviceIds: string[];
}
