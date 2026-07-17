import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Global module so MailService is injectable anywhere (EmployeesModule,
 * AdmissionsModule, TeacherApplicationsModule, ...) without each feature
 * module needing to import MailModule itself — only AppModule imports it.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
