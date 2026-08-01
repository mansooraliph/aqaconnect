import { Module } from '@nestjs/common';
import { RbacModule } from '../../rbac/rbac.module';
import { MobileContextService } from './mobile-context.service';

@Module({
  imports: [RbacModule],
  providers: [MobileContextService],
  exports: [MobileContextService],
})
export class MobileAppApiCommonModule {}
