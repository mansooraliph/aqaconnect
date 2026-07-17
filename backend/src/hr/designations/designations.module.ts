import { Module } from '@nestjs/common';
import { DesignationsController } from './designations.controller';
import { DesignationsService } from './designations.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [DesignationsController],
  providers: [DesignationsService],
  exports: [DesignationsService],
})
export class DesignationsModule {}
