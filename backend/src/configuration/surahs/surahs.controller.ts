import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SurahsService } from './surahs.service';
import { CreateSurahDto } from './dto/create-surah.dto';
import { UpdateSurahDto } from './dto/update-surah.dto';
import { CreateQuranPageDto } from './dto/create-quran-page.dto';
import { BulkUpsertPageLineDto } from './dto/bulk-upsert-page-line.dto';
import { CreateSurahAyahPageLineDto } from './dto/create-surah-ayah-page-line.dto';
import { UpdateSurahAyahPageLineDto } from './dto/update-surah-ayah-page-line.dto';
import { parseSurahAyahPageLineWorkbook } from './surah-ayah-page-lines.import';
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
  list(@Query('surahId') surahId?: string, @Query('juzNumber') juzNumber?: string) {
    return this.service.listPageLines(surahId, juzNumber ? Number(juzNumber) : undefined);
  }

  @Post()
  @RequirePermission('configuration.surahs.manage')
  create(@Body() dto: CreateSurahAyahPageLineDto) {
    return this.service.createPageLine(dto);
  }

  @Get('export')
  @RequirePermission('configuration.surahs.view')
  async export(@Res() res: Response) {
    const buffer = await this.service.exportPageLines();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="surah-ayah-page-lines.xlsx"',
    });
    res.send(buffer);
  }

  @Get('import/file')
  @RequirePermission('configuration.surahs.view')
  async downloadImportedFile(@Res() res: Response) {
    const file = await this.service.getImportedWorkbook();
    if (!file) {
      throw new NotFoundException('No file has been imported yet');
    }
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
    });
    res.send(file.buffer);
  }

  @Get(':id')
  @RequirePermission('configuration.surahs.view')
  findOne(@Param('id') id: string) {
    return this.service.findOnePageLine(id);
  }

  @Patch(':id')
  @RequirePermission('configuration.surahs.manage')
  update(@Param('id') id: string, @Body() dto: UpdateSurahAyahPageLineDto) {
    return this.service.updatePageLine(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('configuration.surahs.manage')
  remove(@Param('id') id: string) {
    return this.service.removePageLine(id);
  }

  @Post('bulk-upsert')
  @RequirePermission('configuration.surahs.manage')
  bulkUpsert(@Body() dto: BulkUpsertPageLineDto) {
    return this.service.bulkUpsertPageLines(dto);
  }

  @Post('import')
  @RequirePermission('configuration.surahs.manage')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('file is required (multipart field name "file")');
    }
    const rows = await parseSurahAyahPageLineWorkbook(file.buffer);
    const result = await this.service.importPageLines(rows);
    await this.service.saveImportedWorkbook(file.buffer, file.originalname);
    return result;
  }
}
