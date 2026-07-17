import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLessonStageDto } from './dto/create-lesson-stage.dto';
import { UpdateLessonStageDto } from './dto/update-lesson-stage.dto';
import { ReorderLessonStageDto } from './dto/reorder-lesson-stage.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';

@Injectable()
export class LessonStagesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.lessonStage.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.lessonStage.findFirst({ where: { id } });
    if (!record) {
      throw new NotFoundException('Lesson stage not found');
    }
    return record;
  }

  create(dto: CreateLessonStageDto) {
    return this.prisma.lessonStage.create({
      data: {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateLessonStageDto) {
    await this.findOne(id);
    return this.prisma.lessonStage.update({ where: { id }, data: dto });
  }

  async bulkAction(dto: BulkActionDto) {
    const where = { id: { in: dto.ids } };
    if (dto.action === 'delete') {
      return this.prisma.lessonStage.deleteMany({ where });
    }
    return this.prisma.lessonStage.updateMany({
      where,
      data: { status: dto.action === 'activate' ? 'ACTIVE' : 'INACTIVE' },
    });
  }

  async nextOrder() {
    const max = await this.prisma.lessonStage.aggregate({
      _max: { sortOrder: true },
    });
    return { nextOrder: (max._max.sortOrder ?? -1) + 1 };
  }

  async reorder(id: string, dto: ReorderLessonStageDto) {
    const current = await this.findOne(id);

    const adjacent = await this.prisma.lessonStage.findFirst({
      where:
        dto.direction === 'up'
          ? { sortOrder: { lt: current.sortOrder } }
          : { sortOrder: { gt: current.sortOrder } },
      orderBy: { sortOrder: dto.direction === 'up' ? 'desc' : 'asc' },
    });

    if (!adjacent) {
      return current;
    }

    const [updatedCurrent] = await this.prisma.$transaction([
      this.prisma.lessonStage.update({
        where: { id: current.id },
        data: { sortOrder: adjacent.sortOrder },
      }),
      this.prisma.lessonStage.update({
        where: { id: adjacent.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);

    return updatedCurrent;
  }
}
