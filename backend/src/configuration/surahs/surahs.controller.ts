import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SurahsService } from './surahs.service';
import { CreateSurahDto } from './dto/create-surah.dto';
import { UpdateSurahDto } from './dto/update-surah.dto';
import { CreateQuranPageDto } from './dto/create-quran-page.dto';
import { BulkUpsertPageLineDto } from './dto/bulk-upsert-page-line.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('surahs')
@UseGuards(PermissionsGuard)
export class SurahsController {
  constructor(private readonly service: SurahsService) {}

  @Get()
  @RequirePermission('configuration.surahs.view')
  list() {
    return this.service.list();
  }

  @Get('stats')
  @RequirePermission('configuration.surahs.view')
  stats() {
    return this.service.stats();
  }

  @Post()
  @RequirePermission('configuration.surahs.manage')
  create(@Body() dto: CreateSurahDto) {
    return this.service.create(dto);
  }

  @Post('import')
  @RequirePermission('configuration.surahs.manage')
  importCanonical() {
    return this.service.importCanonical();
  }

  @Patch(':id')
  @RequirePermission('configuration.surahs.manage')
  update(@Param('id') id: string, @Body() dto: UpdateSurahDto) {
    return this.service.update(id, dto);
  }
}

@Controller('quran-pages')
@UseGuards(PermissionsGuard)
export class QuranPagesController {
  constructor(private readonly service: SurahsService) {}

  @Get()
  @RequirePermission('configuration.surahs.view')
  list() {
    return this.service.listPages();
  }

  @Post()
  @RequirePermission('configuration.surahs.manage')
  create(@Body() dto: CreateQuranPageDto) {
    return this.service.createPage(dto);
  }
}

@Controller('surah-ayah-page-lines')
@UseGuards(PermissionsGuard)
export class SurahAyahPageLinesController {
  constructor(private readonly service: SurahsService) {}

  @Get()
  @RequirePermission('configuration.surahs.view')
  list(@Query('surahId') surahId?: string) {
    return this.service.listPageLines(surahId);
  }

  @Post('bulk-upsert')
  @RequirePermission('configuration.surahs.manage')
  bulkUpsert(@Body() dto: BulkUpsertPageLineDto) {
    return this.service.bulkUpsertPageLines(dto);
  }
}
