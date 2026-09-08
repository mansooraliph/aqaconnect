import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSurahTargetScheduleDto } from './dto/create-surah-target-schedule.dto';
import { UpdateSurahTargetScheduleDto } from './dto/update-surah-target-schedule.dto';
import type { ImportRow } from './surah-target-schedules.import';

@Injectable()
export class SurahTargetSchedulesService {
  // Fixed path so a re-import overwrites the previously stored workbook
  // rather than accumulating versions; survives redeploys since it lives
  // outside dist/.
  private readonly importStorageDir = path.join(process.cwd(), 'storage', 'surah-target-schedules');
  private readonly importFilePath = path.join(this.importStorageDir, 'latest.xlsx');
  private readonly importMetaPath = path.join(this.importStorageDir, 'latest.meta.json');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists the raw uploaded workbook (as-is) so it can be downloaded
   * later. Called only after a successful import, so a bad upload never
   * clobbers the last good backup.
   */
  async saveImportedWorkbook(buffer: Buffer, originalName: string) {
    await fs.mkdir(this.importStorageDir, { recursive: true });
    await fs.writeFile(this.importFilePath, buffer);
    await fs.writeFile(
      this.importMetaPath,
      JSON.stringify({ originalName, importedAt: new Date().toISOString() }),
    );
  }

  /** Returns the last-imported workbook's raw bytes and original filename, or null if none was imported yet. */
  async getImportedWorkbook(): Promise<{ buffer: Buffer; originalName: string } | null> {
    try {
      const buffer = await fs.readFile(this.importFilePath);
      const meta = JSON.parse(await fs.readFile(this.importMetaPath, 'utf8')) as { originalName: string };
      return { buffer, originalName: meta.originalName };
    } catch {
      return null;
    }
  }

  /** Flat list of every day-row in the single master schedule, in import/insertion order. */
  list() {
    return this.prisma.surahTargetSchedule.findMany({
      include: { surah: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.surahTargetSchedule.findUnique({
      where: { id },
      include: { surah: true },
    });
    if (!row) {
      throw new NotFoundException('Surah target schedule row not found');
    }
    return row;
  }

  private async assertSurahExists(surahId: string) {
    const surah = await this.prisma.surah.findUnique({ where: { id: surahId } });
    if (!surah) {
      throw new BadRequestException('surahId must reference an existing Surah');
    }
  }

  async create(dto: CreateSurahTargetScheduleDto) {
    if (dto.surahId) {
      await this.assertSurahExists(dto.surahId);
    }
    const last = await this.prisma.surahTargetSchedule.findFirst({ orderBy: { sortOrder: 'desc' } });
    return this.prisma.surahTargetSchedule.create({
      data: { ...dto, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  }

  async update(id: string, dto: UpdateSurahTargetScheduleDto) {
    await this.findOne(id);
    if (dto.surahId) {
      await this.assertSurahExists(dto.surahId);
    }
    return this.prisma.surahTargetSchedule.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.surahTargetSchedule.delete({ where: { id } });
  }

  /**
   * Bulk-imports parsed spreadsheet rows into the single master schedule.
   * All existing rows are replaced wholesale (re-uploading the file is
   * idempotent rather than appending duplicates).
   */
  async importRows(rows: ImportRow[]) {
    const surahNumbers = [...new Set(rows.map((r) => r.surahNumber).filter((n): n is number => n !== null))];
    const surahs = await this.prisma.surah.findMany({ where: { number: { in: surahNumbers } } });
    const surahIdByNumber = new Map(surahs.map((s) => [s.number, s.id]));

    const missing = surahNumbers.filter((n) => !surahIdByNumber.has(n));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Surah number(s) not found in the Surah table: ${missing.join(', ')}. Import the 114 Surahs first.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.surahTargetSchedule.deleteMany({});
      if (rows.length === 0) {
        return { imported: 0 };
      }
      await tx.surahTargetSchedule.createMany({
        data: rows.map((r, index) => ({
          sortOrder: index,
          dayNumber: r.dayNumber,
          // This master schedule is exclusively the Hifdh curriculum (no
          // Doura/Revision import path exists yet) — stamped here so
          // HifdhService.generateInitialSchedulesForStudent's `stage:
          // 'HIFDH'` filter actually matches these rows.
          stage: 'HIFDH',
          surahId: r.surahNumber !== null ? (surahIdByNumber.get(r.surahNumber) ?? null) : null,
          fromAyah: r.fromAyah,
          toAyah: r.toAyah,
          scheduleType: r.scheduleType,
          examName: r.examName,
        })),
      });
      return { imported: rows.length };
    });
  }
}
