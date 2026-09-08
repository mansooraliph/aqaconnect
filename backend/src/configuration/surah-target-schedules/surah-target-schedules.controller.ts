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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SurahTargetSchedulesService } from './surah-target-schedules.service';
import { CreateSurahTargetScheduleDto } from './dto/create-surah-target-schedule.dto';
import { UpdateSurahTargetScheduleDto } from './dto/update-surah-target-schedule.dto';
import { parseSurahTargetScheduleWorkbook } from './surah-target-schedules.import';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('surah-target-schedules')
@UseGuards(PermissionsGuard)
export class SurahTargetSchedulesController {
  constructor(private readonly service: SurahTargetSchedulesService) {}

  @Get()
  @RequirePermission('configuration.target_schedules.view')
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermission('configuration.target_schedules.manage')
  create(@Body() dto: CreateSurahTargetScheduleDto) {
    return this.service.create(dto);
  }

  @Post('import')
  @RequirePermission('configuration.target_schedules.manage')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('file is required (multipart field name "file")');
    }
    const rows = await parseSurahTargetScheduleWorkbook(file.buffer);
    const result = await this.service.importRows(rows);
    await this.service.saveImportedWorkbook(file.buffer, file.originalname);
    return result;
  }

  @Get('import/file')
  @RequirePermission('configuration.target_schedules.view')
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
  @RequirePermission('configuration.target_schedules.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('configuration.target_schedules.manage')
  update(@Param('id') id: string, @Body() dto: UpdateSurahTargetScheduleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('configuration.target_schedules.manage')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
