import { Module } from '@nestjs/common';
import {
  SurahsController,
  QuranPagesController,
  SurahAyahPageLinesController,
} from './surahs.controller';
import { SurahsService } from './surahs.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [SurahsController, QuranPagesController, SurahAyahPageLinesController],
  providers: [SurahsService],
  exports: [SurahsService],
})
export class SurahsModule {}
