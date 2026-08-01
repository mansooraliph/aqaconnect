import { Module } from '@nestjs/common';
import { SurahSchedulesController } from './surah-schedules.controller';
import { SurahSchedulesService } from './surah-schedules.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';

@Module({
  imports: [MobileAppApiCommonModule],
  controllers: [SurahSchedulesController],
  providers: [SurahSchedulesService],
})
export class SurahSchedulesModule {}
