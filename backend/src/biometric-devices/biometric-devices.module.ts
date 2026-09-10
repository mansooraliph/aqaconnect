import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { IclockController } from './iclock.controller';
import { IclockService } from './iclock.service';
import { BiometricDevicesController } from './biometric-devices.controller';
import { BiometricDevicesService } from './biometric-devices.service';
import { BiometricDevicesAdminController } from './biometric-devices-admin.controller';
import { BiometricDevicesAdminService } from './biometric-devices-admin.service';

@Module({
  imports: [RbacModule],
  controllers: [IclockController, BiometricDevicesController, BiometricDevicesAdminController],
  providers: [IclockService, BiometricDevicesService, BiometricDevicesAdminService],
})
export class BiometricDevicesModule {}
