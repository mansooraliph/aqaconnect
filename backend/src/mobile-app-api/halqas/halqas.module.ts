import { Module } from '@nestjs/common';
import { HalqasController } from './halqas.controller';
import { MobileHalqasService } from './halqas.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';

@Module({
  imports: [MobileAppApiCommonModule],
  controllers: [HalqasController],
  providers: [MobileHalqasService],
})
export class HalqasModule {}
