import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { RbacModule } from '../rbac/rbac.module';
import { CalendarDaysModule } from '../configuration/calendar-days/calendar-days.module';
import { BranchSettingsModule } from '../configuration/branch-settings/branch-settings.module';
import { HifdhModule } from '../academic/hifdh/hifdh.module';

@Module({
  imports: [RbacModule, CalendarDaysModule, BranchSettingsModule, HifdhModule],
  controllers: [BranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
