import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSurahDto } from './dto/create-surah.dto';
import { UpdateSurahDto } from './dto/update-surah.dto';
import { CreateQuranPageDto } from './dto/create-quran-page.dto';
import { BulkUpsertPageLineDto } from './dto/bulk-upsert-page-line.dto';
import { CreateSurahAyahPageLineDto } from './dto/create-surah-ayah-page-line.dto';
import { UpdateSurahAyahPageLineDto } from './dto/update-surah-ayah-page-line.dto';
import { CANONICAL_SURAHS } from './surahs-data';
import type { PageLineImportRow } from './surah-ayah-page-lines.import';

@Injectable()
export class SurahsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Surahs ---

  list() {
    return this.prisma.surah.findMany({ orderBy: { number: 'asc' } });
  }

  async findOne(id: string) {
    const record = await this.prisma.surah.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('Surah not found');
    }
    return record;
  }

  create(dto: CreateSurahDto) {
    return this.prisma.surah.create({ data: dto });
  }

  async update(id: string, dto: UpdateSurahDto) {
    await this.findOne(id);
    return this.prisma.surah.update({ where: { id }, data: dto });
  }

  async importCanonical() {
    let created = 0;
    let skipped = 0;

    for (const surah of CANONICAL_SURAHS) {
      const existing = await this.prisma.surah.findUnique({ where: { number: surah.number } });
      if (existing) {
        skipped += 1;
        continue;
      }
      await this.prisma.surah.create({ data: surah });
      created += 1;
    }

    return { created, skipped };
  }

  async stats() {
    const surahs = await this.prisma.surah.findMany();
    const totalSurahs = surahs.length;
    const totalAyahs = surahs.reduce((sum, s) => sum + s.totalAyahs, 0);
    const makkiCount = surahs.filter((s) => s.revelationType === 'MAKKI').length;
    const madaniCount = surahs.filter((s) => s.revelationType === 'MADANI').length;

    return { totalSurahs, totalAyahs, makkiCount, madaniCount };
  }

  // --- Quran Pages ---

  listPages() {
    return this.prisma.quranPage.findMany({ orderBy: { pageNumber: 'asc' } });
  }

  createPage(dto: CreateQuranPageDto) {
    return this.prisma.quranPage.create({
      data: { pageNumber: dto.pageNumber, lineCount: dto.lineCount ?? 15 },
    });
  }

  // --- Surah/Ayah/Page/Line mapping ---

  listPageLines(surahId?: string, juzNumber?: number) {
    return this.prisma.surahAyahPageLine.findMany({
      where: {
        ...(surahId && { surahId }),
        ...(juzNumber !== undefined && { juzNumber }),
      },
      include: { quranPage: true },
      orderBy: [{ surahId: 'asc' }, { ayahNumber: 'asc' }],
    });
  }

  async findOnePageLine(id: string) {
    const record = await this.prisma.surahAyahPageLine.findUnique({
      where: { id },
      include: { quranPage: true },
    });
    if (!record) {
      throw new NotFoundException('Surah ayah/page/line row not found');
    }
    return record;
  }

  /** Finds the QuranPage for a page number, creating it (default 15 lines) if it doesn't exist yet. */
  private async findOrCreateQuranPage(pageNumber: number) {
    const existing = await this.prisma.quranPage.findUnique({ where: { pageNumber } });
    if (existing) return existing;
    return this.prisma.quranPage.create({ data: { pageNumber, lineCount: 15 } });
  }

  async createPageLine(dto: CreateSurahAyahPageLineDto) {
    const quranPage = await this.findOrCreateQuranPage(dto.pageNumber);
    return this.prisma.surahAyahPageLine.create({
      data: {
        surahId: dto.surahId,
        ayahNumber: dto.ayahNumber,
        juzNumber: dto.juzNumber,
        quranPageId: quranPage.id,
        lineFrom: dto.lineFrom,
        lineTo: dto.lineTo,
      },
      include: { quranPage: true },
    });
  }

  async updatePageLine(id: string, dto: UpdateSurahAyahPageLineDto) {
    await this.findOnePageLine(id);
    const quranPageId = dto.pageNumber !== undefined ? (await this.findOrCreateQuranPage(dto.pageNumber)).id : undefined;
    return this.prisma.surahAyahPageLine.update({
      where: { id },
      data: {
        ...(dto.surahId !== undefined && { surahId: dto.surahId }),
        ...(dto.ayahNumber !== undefined && { ayahNumber: dto.ayahNumber }),
        ...(dto.juzNumber !== undefined && { juzNumber: dto.juzNumber }),
        ...(quranPageId !== undefined && { quranPageId }),
        ...(dto.lineFrom !== undefined && { lineFrom: dto.lineFrom }),
        ...(dto.lineTo !== undefined && { lineTo: dto.lineTo }),
      },
      include: { quranPage: true },
    });
  }

  async removePageLine(id: string) {
    await this.findOnePageLine(id);
    await this.prisma.surahAyahPageLine.delete({ where: { id } });
  }

  async bulkUpsertPageLines(dto: BulkUpsertPageLineDto) {
    const results = await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.surahAyahPageLine.upsert({
          where: {
            surahId_ayahNumber: {
              surahId: item.surahId,
              ayahNumber: item.ayahNumber,
            },
          },
          create: {
            surahId: item.surahId,
            ayahNumber: item.ayahNumber,
            juzNumber: item.juzNumber,
            quranPageId: item.quranPageId,
            lineFrom: item.lineFrom,
            lineTo: item.lineTo,
          },
          update: {
            juzNumber: item.juzNumber,
            quranPageId: item.quranPageId,
            lineFrom: item.lineFrom,
            lineTo: item.lineTo,
          },
        }),
      ),
    );

    return { upserted: results.length };
  }

  /**
   * Bulk-imports the full ayah <-> page/line mapping from a spreadsheet.
   * Reference data curated via import/export — re-uploading replaces the
   * entire mapping wholesale rather than appending/merging.
   */
  async importPageLines(rows: PageLineImportRow[]) {
    const surahNumbers = [...new Set(rows.map((r) => r.surahNumber))];
    const surahs = await this.prisma.surah.findMany({ where: { number: { in: surahNumbers } } });
    const surahIdByNumber = new Map(surahs.map((s) => [s.number, s.id]));

    const missingSurahs = surahNumbers.filter((n) => !surahIdByNumber.has(n));
    if (missingSurahs.length > 0) {
      throw new BadRequestException(
        `Surah number(s) not found in the Surah table: ${missingSurahs.join(', ')}. Import the 114 Surahs first.`,
      );
    }

    const pageNumbers = [...new Set(rows.map((r) => r.pageNumber))];

    return this.prisma.$transaction(async (tx) => {
      await tx.quranPage.createMany({
        data: pageNumbers.map((pageNumber) => ({ pageNumber, lineCount: 15 })),
        skipDuplicates: true,
      });
      const pages = await tx.quranPage.findMany({ where: { pageNumber: { in: pageNumbers } } });
      const pageIdByNumber = new Map(pages.map((p) => [p.pageNumber, p.id]));

      await tx.surahAyahPageLine.deleteMany({});
      if (rows.length === 0) {
        return { imported: 0 };
      }

      // The sheet's "Line No" is where each ayah ENDS, not where it starts.
      // An ayah's start line is derived: it continues from wherever the
      // previous ayah ended (they can share a line), except at a page
      // boundary, where a new page always starts fresh at line 1. Rows are
      // in Quran order (as read from the sheet), so a single pass suffices.
      let prevPageNumber: number | null = null;
      let prevLineTo = 0;
      const data = rows.map((r) => {
        const lineFrom = r.pageNumber === prevPageNumber ? prevLineTo : 1;
        prevPageNumber = r.pageNumber;
        prevLineTo = r.lineNo;
        return {
          surahId: surahIdByNumber.get(r.surahNumber)!,
          ayahNumber: r.ayahNumber,
          juzNumber: r.juzNumber,
          quranPageId: pageIdByNumber.get(r.pageNumber)!,
          lineFrom,
          lineTo: r.lineNo,
        };
      });

      await tx.surahAyahPageLine.createMany({ data });
      return { imported: rows.length };
    });
  }

  /** Exports the full ayah <-> page/line mapping in the same column layout the import expects (round-trippable). */
  async exportPageLines(): Promise<Buffer> {
    const rows = await this.prisma.surahAyahPageLine.findMany({
      include: { surah: true, quranPage: true },
      orderBy: [{ surah: { number: 'asc' } }, { ayahNumber: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow(['Sura No', 'Sura Name', 'Ayath No', 'Juzh No', 'Page No', 'Line No']);
    for (const row of rows) {
      sheet.addRow([
        row.surah.number,
        row.surah.nameArabic,
        row.ayahNumber,
        row.juzNumber,
        row.quranPage.pageNumber,
        row.lineTo,
      ]);
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
