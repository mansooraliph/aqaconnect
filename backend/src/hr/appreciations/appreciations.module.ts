import { Module } from '@nestjs/common';
import { AppreciationsController } from './appreciations.controller';
import { AppreciationsService } from './appreciations.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [AppreciationsController],
  providers: [AppreciationsService],
  exports: [AppreciationsService],
})
export class AppreciationsModule {}
