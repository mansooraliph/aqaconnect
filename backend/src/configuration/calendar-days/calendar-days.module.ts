import { Module } from '@nestjs/common';
import { CalendarDaysController } from './calendar-days.controller';
import { CalendarDaysService } from './calendar-days.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [CalendarDaysController],
  providers: [CalendarDaysService],
  exports: [CalendarDaysService],
})
export class CalendarDaysModule {}
