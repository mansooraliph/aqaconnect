import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSurahDto } from './dto/create-surah.dto';
import { UpdateSurahDto } from './dto/update-surah.dto';
import { CreateQuranPageDto } from './dto/create-quran-page.dto';
import { BulkUpsertPageLineDto } from './dto/bulk-upsert-page-line.dto';
import { CANONICAL_SURAHS } from './surahs-data';

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
    const meccanCount = surahs.filter((s) => s.revelationType === 'Meccan').length;
    const medinanCount = surahs.filter((s) => s.revelationType === 'Medinan').length;

    return { totalSurahs, totalAyahs, meccanCount, medinanCount };
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

  listPageLines(surahId?: string) {
    return this.prisma.surahAyahPageLine.findMany({
      where: surahId ? { surahId } : undefined,
      orderBy: [{ surahId: 'asc' }, { ayahNumber: 'asc' }],
    });
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
            quranPageId: item.quranPageId,
            lineNumber: item.lineNumber,
          },
          update: {
            quranPageId: item.quranPageId,
            lineNumber: item.lineNumber,
          },
        }),
      ),
    );

    return { upserted: results.length };
  }
}
