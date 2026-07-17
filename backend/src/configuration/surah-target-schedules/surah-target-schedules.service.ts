import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSurahTargetScheduleDto } from './dto/create-surah-target-schedule.dto';
import { UpdateSurahTargetScheduleDto } from './dto/update-surah-target-schedule.dto';
import { UpsertSurahTargetsDto } from './dto/upsert-surah-target.dto';

@Injectable()
export class SurahTargetSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.surahTargetSchedule.findMany({
      include: { surah: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const schedule = await this.prisma.surahTargetSchedule.findUnique({
      where: { id },
      include: { surah: true },
    });
    if (!schedule) {
      throw new NotFoundException('Surah target schedule not found');
    }
    return schedule;
  }

  private async assertSurahExists(surahId: string) {
    const surah = await this.prisma.surah.findUnique({ where: { id: surahId } });
    if (!surah) {
      throw new BadRequestException('surahId must reference an existing Surah');
    }
  }

  async create(dto: CreateSurahTargetScheduleDto) {
    await this.assertSurahExists(dto.surahId);
    return this.prisma.surahTargetSchedule.create({
      data: {
        surahId: dto.surahId,
        name: dto.name,
        ...(dto.targetsPerDay !== undefined && { targetsPerDay: dto.targetsPerDay }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async update(id: string, dto: UpdateSurahTargetScheduleDto) {
    await this.findOne(id);
    if (dto.surahId !== undefined) {
      await this.assertSurahExists(dto.surahId);
    }
    return this.prisma.surahTargetSchedule.update({
      where: { id },
      data: {
        ...(dto.surahId !== undefined && { surahId: dto.surahId }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.targetsPerDay !== undefined && { targetsPerDay: dto.targetsPerDay }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async listTargets(id: string) {
    await this.findOne(id);
    return this.prisma.surahTarget.findMany({
      where: { surahTargetScheduleId: id },
      orderBy: { dayNumber: 'asc' },
    });
  }

  /** Replace-all semantics: the posted array becomes the new complete set of targets. */
  async upsertTargets(id: string, dto: UpsertSurahTargetsDto) {
    await this.findOne(id);

    const dayNumbers = dto.targets.map((t) => t.dayNumber);
    if (new Set(dayNumbers).size !== dayNumbers.length) {
      throw new BadRequestException('dayNumber must be unique within the posted targets');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.surahTarget.deleteMany({
        where: {
          surahTargetScheduleId: id,
          ...(dayNumbers.length > 0 && { dayNumber: { notIn: dayNumbers } }),
        },
      });

      for (const target of dto.targets) {
        await tx.surahTarget.upsert({
          where: {
            surahTargetScheduleId_dayNumber: {
              surahTargetScheduleId: id,
              dayNumber: target.dayNumber,
            },
          },
          create: {
            surahTargetScheduleId: id,
            dayNumber: target.dayNumber,
            fromAyah: target.fromAyah,
            toAyah: target.toAyah,
          },
          update: {
            fromAyah: target.fromAyah,
            toAyah: target.toAyah,
          },
        });
      }

      return tx.surahTarget.findMany({
        where: { surahTargetScheduleId: id },
        orderBy: { dayNumber: 'asc' },
      });
    });
  }
}
