import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLessonSubStageDto } from './dto/create-lesson-sub-stage.dto';
import { UpdateLessonSubStageDto } from './dto/update-lesson-sub-stage.dto';
import { ReorderLessonSubStageDto } from './dto/reorder-lesson-sub-stage.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';

@Injectable()
export class LessonSubStagesService {
  constructor(private readonly prisma: PrismaService) {}

  list(lessonStageId?: string) {
    return this.prisma.lessonSubStage.findMany({
      where: lessonStageId ? { lessonStageId } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const record = await this.prisma.lessonSubStage.findFirst({ where: { id } });
    if (!record) {
      throw new NotFoundException('Lesson sub-stage not found');
    }
    return record;
  }

  create(dto: CreateLessonSubStageDto) {
    return this.prisma.lessonSubStage.create({
      data: {
        lessonStageId: dto.lessonStageId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateLessonSubStageDto) {
    await this.findOne(id);
    return this.prisma.lessonSubStage.update({ where: { id }, data: dto });
  }

  async bulkAction(dto: BulkActionDto) {
    const where = { id: { in: dto.ids } };
    if (dto.action === 'delete') {
      return this.prisma.lessonSubStage.deleteMany({ where });
    }
    return this.prisma.lessonSubStage.updateMany({
      where,
      data: { status: dto.action === 'activate' ? 'ACTIVE' : 'INACTIVE' },
    });
  }

  async nextOrder(lessonStageId?: string) {
    const max = await this.prisma.lessonSubStage.aggregate({
      where: lessonStageId ? { lessonStageId } : undefined,
      _max: { sortOrder: true },
    });
    return { nextOrder: (max._max.sortOrder ?? -1) + 1 };
  }

  async reorder(id: string, dto: ReorderLessonSubStageDto) {
    const current = await this.findOne(id);

    const adjacent = await this.prisma.lessonSubStage.findFirst({
      where:
        dto.direction === 'up'
          ? { lessonStageId: current.lessonStageId, sortOrder: { lt: current.sortOrder } }
          : { lessonStageId: current.lessonStageId, sortOrder: { gt: current.sortOrder } },
      orderBy: { sortOrder: dto.direction === 'up' ? 'desc' : 'asc' },
    });

    if (!adjacent) {
      return current;
    }

    const [updatedCurrent] = await this.prisma.$transaction([
      this.prisma.lessonSubStage.update({
        where: { id: current.id },
        data: { sortOrder: adjacent.sortOrder },
      }),
      this.prisma.lessonSubStage.update({
        where: { id: adjacent.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);

    return updatedCurrent;
  }
}
