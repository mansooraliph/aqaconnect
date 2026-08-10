import { ForbiddenException, Injectable } from '@nestjs/common';
import { ProgressEntryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async teacherDashboard(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!teacher) {
      throw new ForbiddenException('This account has no linked teacher profile');
    }

    const halqas = await this.prisma.halqa.findMany({
      where: { teacherId: teacher.id, branchId: teacher.branchId },
      select: { id: true },
    });
    const halqaIds = halqas.map((h) => h.id);

    // Legacy shortcut for a teacher with no Halqas at all: a materially
    // different response shape (no `user` key, `announcements` as an empty
    // array rather than the single-object placeholder below) — the real
    // mobile client's Dart model expects exactly this split, so it's
    // replicated verbatim rather than "fixed" into one consistent shape.
    if (halqaIds.length === 0) {
      return {
        total_students: 0,
        recited_students: 0,
        students_completed_today: 0,
        percentage_completed_today: 0,
        announcements: [] as unknown[],
      };
    }

    const memberships = await this.prisma.halqaStudent.findMany({
      where: { halqaId: { in: halqaIds }, removedAt: null },
      select: { studentId: true },
    });
    const studentIds = [...new Set(memberships.map((m) => m.studentId))];
    const totalStudents = studentIds.length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [recitedStudentIds, completedTodayStudentIds] = studentIds.length
      ? await Promise.all([
          this.prisma.studentSurahProgressEntry
            .findMany({
              where: { studentId: { in: studentIds }, status: ProgressEntryStatus.COMPLETED },
              select: { studentId: true },
              distinct: ['studentId'],
            })
            .then((rows) => rows.map((r) => r.studentId)),
          this.prisma.studentSurahProgressEntry
            .findMany({
              where: {
                studentId: { in: studentIds },
                status: ProgressEntryStatus.COMPLETED,
                completedAt: { gte: todayStart, lte: todayEnd },
              },
              select: { studentId: true },
              distinct: ['studentId'],
            })
            .then((rows) => rows.map((r) => r.studentId)),
        ])
      : [[], []];

    // Legacy fetches up to 5 announcements but only ever surfaces the first
    // (dead code in the source) — replicated as a single object, not an
    // array, matching the mobile client's Dart model for this shape.
    const [latestAnnouncement] = await this.prisma.announcement.findMany({
      where: { branchId: teacher.branchId },
      orderBy: { publishedAt: 'desc' },
      take: 1,
    });

    return {
      user: { id: teacher.user.id, name: [teacher.user.firstName, teacher.user.lastName].filter(Boolean).join(' '), email: teacher.user.email },
      total_students: totalStudents,
      recited_students: recitedStudentIds.length,
      students_completed_today: completedTodayStudentIds.length,
      percentage_completed_today: totalStudents > 0 ? Math.round((completedTodayStudentIds.length / totalStudents) * 10000) / 100 : 0,
      announcements: {
        icon: latestAnnouncement?.icon ?? '📢',
        title: latestAnnouncement?.title ?? 'No announcements',
        description: latestAnnouncement?.description ?? 'There are no announcements for you today.',
        date: new Date().toISOString().slice(0, 10),
      },
    };
  }
}
