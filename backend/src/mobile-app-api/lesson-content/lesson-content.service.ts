import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LessonsService } from '../../academic/lessons/lessons.service';

@Injectable()
export class LessonContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonsService: LessonsService,
  ) {}

  // LessonStage/LessonSubStage are shared curriculum config, not branch-scoped
  // (see academic/lessons/lessons.service.ts's assertLessonStageAndSubStage).
  listStages() {
    return this.prisma.lessonStage.findMany({
      include: { subStages: { orderBy: { sortOrder: 'asc' } }, _count: { select: { lessons: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findStage(id: string) {
    const stage = await this.prisma.lessonStage.findFirst({
      where: { id },
      include: { subStages: { orderBy: { sortOrder: 'asc' } }, _count: { select: { lessons: true } } },
    });
    if (!stage) {
      throw new NotFoundException('Lesson stage not found');
    }
    return stage;
  }

  listLessons(branchId: string, lessonStageId?: string, lessonSubStageId?: string) {
    return this.lessonsService.list(branchId, lessonStageId, lessonSubStageId);
  }
}
