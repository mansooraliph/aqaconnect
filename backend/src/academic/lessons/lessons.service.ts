import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string, lessonStageId?: string, lessonSubStageId?: string) {
    return this.prisma.lesson.findMany({
      where: {
        branchId,
        ...(lessonStageId && { lessonStageId }),
        ...(lessonSubStageId && { lessonSubStageId }),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.lesson.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Lesson not found');
    }
    return record;
  }

  /**
   * LessonStage/LessonSubStage are shared curriculum config, not branch-scoped,
   * so only existence is checked here — never branch ownership.
   */
  private async assertLessonStageAndSubStage(lessonStageId: string, lessonSubStageId?: string) {
    const lessonStage = await this.prisma.lessonStage.findFirst({ where: { id: lessonStageId } });
    if (!lessonStage) {
      throw new BadRequestException('lessonStageId does not exist');
    }
    if (lessonSubStageId) {
      const lessonSubStage = await this.prisma.lessonSubStage.findFirst({
        where: { id: lessonSubStageId, lessonStageId },
      });
      if (!lessonSubStage) {
        throw new BadRequestException('lessonSubStageId must belong to the given lessonStageId');
      }
    }
  }

  async create(branchId: string, dto: CreateLessonDto) {
    await this.assertLessonStageAndSubStage(dto.lessonStageId, dto.lessonSubStageId);
    return this.prisma.lesson.create({
      data: {
        branchId,
        lessonStageId: dto.lessonStageId,
        lessonSubStageId: dto.lessonSubStageId,
        title: dto.title,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(branchId: string, id: string, dto: UpdateLessonDto) {
    await this.findOne(branchId, id);
    return this.prisma.lesson.update({ where: { id }, data: dto });
  }

  async nextOrder(branchId: string, lessonStageId?: string) {
    const max = await this.prisma.lesson.aggregate({
      where: {
        branchId,
        ...(lessonStageId && { lessonStageId }),
      },
      _max: { sortOrder: true },
    });
    return { nextOrder: (max._max.sortOrder ?? -1) + 1 };
  }
}
