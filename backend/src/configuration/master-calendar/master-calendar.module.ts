import { Module } from '@nestjs/common';
import { MasterCalendarController } from './master-calendar.controller';
import { MasterCalendarService } from './master-calendar.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [MasterCalendarController],
  providers: [MasterCalendarService],
  exports: [MasterCalendarService],
})
export class MasterCalendarModule {}
