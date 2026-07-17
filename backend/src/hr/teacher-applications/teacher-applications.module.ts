import { Module } from '@nestjs/common';
import { TeacherApplicationsController } from './teacher-applications.controller';
import { TeacherApplicationsService } from './teacher-applications.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [TeacherApplicationsController],
  providers: [TeacherApplicationsService],
})
export class TeacherApplicationsModule {}
