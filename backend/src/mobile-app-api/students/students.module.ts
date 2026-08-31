import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { MobileStudentsService } from './students.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';
import { HifdhModule } from '../../academic/hifdh/hifdh.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [MobileAppApiCommonModule, HifdhModule, RbacModule],
  controllers: [StudentsController],
  providers: [MobileStudentsService],
})
export class StudentsModule {}
