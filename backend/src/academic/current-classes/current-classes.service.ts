import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CurrentClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Derived read view — see schema.prisma's note above CalendarDay: "Current
   * Classes" is intentionally not a stored table. It joins
   * AcademicClassSectionYear (for the branch's current AcademicYear) with a
   * COUNT of active StudentEnrollment rows per class-section-year.
   */
  async list(branchId: string) {
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { branchId, isCurrent: true },
    });

    if (!currentYear) {
      return {
        academicYear: null,
        classes: [],
        note: 'No current academic year is set for this branch.',
      };
    }

    const classSectionYears = await this.prisma.academicClassSectionYear.findMany({
      where: { academicYearId: currentYear.id },
      include: {
        academicClassSection: {
          include: {
            academicClass: { select: { name: true } },
            academicSection: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { academicClassSection: { academicClass: { sortOrder: 'asc' } } },
        { academicClassSection: { academicSection: { name: 'asc' } } },
      ],
    });

    const enrollmentCounts = await this.prisma.studentEnrollment.groupBy({
      by: ['academicClassSectionYearId'],
      where: {
        status: 'ACTIVE',
        academicClassSectionYearId: { in: classSectionYears.map((c) => c.id) },
      },
      _count: { _all: true },
    });
    const countsById = new Map(enrollmentCounts.map((c) => [c.academicClassSectionYearId, c._count._all]));

    return {
      academicYear: { id: currentYear.id, name: currentYear.name },
      classes: classSectionYears.map((csy) => ({
        id: csy.id,
        className: csy.academicClassSection.academicClass.name,
        sectionName: csy.academicClassSection.academicSection.name,
        capacity: csy.capacity ?? csy.academicClassSection.capacity ?? null,
        enrolledCount: countsById.get(csy.id) ?? 0,
      })),
    };
  }
}
