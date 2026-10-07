import { Module } from '@nestjs/common';
import { MasterCalendarController } from './master-calendar.controller';
import { MasterCalendarService } from './master-calendar.service';
import { RbacModule } from '../../rbac/rbac.module';
import { HifdhModule } from '../../academic/hifdh/hifdh.module';

@Module({
  imports: [RbacModule, HifdhModule],
  controllers: [MasterCalendarController],
  providers: [MasterCalendarService],
  exports: [MasterCalendarService],
})
export class MasterCalendarModule {}
