import { Module } from '@nestjs/common';
import { SurahTargetSchedulesController } from './surah-target-schedules.controller';
import { SurahTargetSchedulesService } from './surah-target-schedules.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [SurahTargetSchedulesController],
  providers: [SurahTargetSchedulesService],
  exports: [SurahTargetSchedulesService],
})
export class SurahTargetSchedulesModule {}
