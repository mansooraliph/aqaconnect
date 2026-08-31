import { Module } from '@nestjs/common';
import { HalqasController } from './halqas.controller';
import { MobileHalqasService } from './halqas.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [MobileAppApiCommonModule, RbacModule],
  controllers: [HalqasController],
  providers: [MobileHalqasService],
})
export class HalqasModule {}
