import { Module } from '@nestjs/common';
import { RbacModule } from '../../rbac/rbac.module';
import { MobileContextService } from './mobile-context.service';
import { MobileApiLoggingInterceptor } from './mobile-api-logging.interceptor';

@Module({
  imports: [RbacModule],
  providers: [MobileContextService, MobileApiLoggingInterceptor],
  exports: [MobileContextService, MobileApiLoggingInterceptor],
})
export class MobileAppApiCommonModule {}
