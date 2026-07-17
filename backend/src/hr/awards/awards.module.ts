import { Module } from '@nestjs/common';
import { AwardsController } from './awards.controller';
import { AwardsService } from './awards.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [AwardsController],
  providers: [AwardsService],
  exports: [AwardsService],
})
export class AwardsModule {}
