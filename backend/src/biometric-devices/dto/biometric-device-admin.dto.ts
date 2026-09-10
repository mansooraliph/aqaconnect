import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from './biometric-query.dto';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

export class AssignDeviceDto {
  @IsString()
  branchId: string;
}

export class DeactivateDeviceDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class BulkDeviceActionDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  deviceIds: string[];
}

export interface BulkActionResult {
  success_count: number;
  failed_count: number;
  failed_devices: string[];
  message: string;
}

export class ListDevicesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isApproved?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isAssigned?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ListCommandsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  sn?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  status?: number;
}
