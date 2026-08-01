import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { MobileStudentsService } from './students.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { HifdhModule } from '../../academic/hifdh/hifdh.module';

@Module({
  imports: [MobileAppApiCommonModule, HifdhModule],
  controllers: [StudentsController],
  providers: [MobileStudentsService],
})
export class StudentsModule {}
