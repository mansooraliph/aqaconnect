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
  //
  // Legacy's Eloquent `withCount(['subStages', 'lessons'])` adds flat
  // `sub_stages_count`/`lessons_count` integer fields directly on each stage
  // — the mobile client's Dart model requires those as non-nullable ints, so
  // they're added here alongside (not instead of) Prisma's own nested
  // `_count` shape and the full `subStages` array.
  private withCounts<T extends { subStages: unknown[]; _count: { lessons: number } }>(stage: T) {
    return {
      ...stage,
      sub_stages_count: stage.subStages.length,
      lessons_count: stage._count.lessons,
    };
  }

  async listStages() {
    const stages = await this.prisma.lessonStage.findMany({
      include: { subStages: { orderBy: { sortOrder: 'asc' } }, _count: { select: { lessons: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return stages.map((s) => this.withCounts(s));
  }

  async findStage(id: string) {
    const stage = await this.prisma.lessonStage.findFirst({
      where: { id },
      include: { subStages: { orderBy: { sortOrder: 'asc' } }, _count: { select: { lessons: true } } },
    });
    if (!stage) {
      throw new NotFoundException('Lesson stage not found');
    }
    return this.withCounts(stage);
  }

  listLessons(branchId: string, lessonStageId?: string, lessonSubStageId?: string) {
    return this.lessonsService.list(branchId, lessonStageId, lessonSubStageId);
  }
}
