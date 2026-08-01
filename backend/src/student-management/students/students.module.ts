import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { RbacModule } from '../../rbac/rbac.module';
import { HifdhModule } from '../../academic/hifdh/hifdh.module';

@Module({
  imports: [RbacModule, HifdhModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
