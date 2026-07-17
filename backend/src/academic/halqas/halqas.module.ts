import { Module } from '@nestjs/common';
import { HalqasController } from './halqas.controller';
import { HalqasService } from './halqas.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [HalqasController],
  providers: [HalqasService],
  exports: [HalqasService],
})
export class HalqasModule {}
