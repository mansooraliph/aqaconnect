import { Module } from '@nestjs/common';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { MobileAppApiCommonModule } from '../common/mobile-app-api-common.module';

@Module({
  imports: [MobileAppApiCommonModule],
  controllers: [TeachersController],
  providers: [TeachersService],
})
export class TeachersModule {}
