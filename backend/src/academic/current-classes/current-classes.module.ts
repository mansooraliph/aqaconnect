import { Module } from '@nestjs/common';
import { CurrentClassesController } from './current-classes.controller';
import { CurrentClassesService } from './current-classes.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [CurrentClassesController],
  providers: [CurrentClassesService],
  exports: [CurrentClassesService],
})
export class CurrentClassesModule {}
