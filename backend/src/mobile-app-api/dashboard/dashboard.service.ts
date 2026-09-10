import { ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceStatus, ProgressEntryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileContextService } from '../common/mobile-context.service';

const DONE_STATUSES: ProgressEntryStatus[] = [ProgressEntryStatus.COMPLETED, ProgressEntryStatus.VERIFIED];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileContext: MobileContextService,
  ) {}

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

    // Legacy has a second response shape for "no Halqas at all" (omits
    // `user`, `announcements` as an empty array) but that path is untested
    // in production — every real teacher account has ≥1 Halqa — and the
    // mobile client's Dart model crashes on it (List where it expects a Map).
    // Always return the one shape the client actually handles instead.
    const memberships = halqaIds.length
      ? await this.prisma.halqaStudent.findMany({
          where: { halqaId: { in: halqaIds }, removedAt: null },
          select: { studentId: true },
        })
      : [];
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

  /**
   * Legacy: `ApiController::adminDashboard`, scoped by `company()->id` and
   * gated by `$user->hasRole('admin')`. aqa_v2 has no single "admin" role —
   * both "Super Admin" (GLOBAL) and "Branch Admin" (BRANCH) count, so the
   * gate is "any role whose name contains admin" rather than an exact match.
   */
  async adminDashboard(userId: string) {
    const roleNames = await this.mobileContext.getRoleNames(userId);
    if (!roleNames.some((name) => name.includes('admin'))) {
      throw new ForbiddenException('Unauthorized. Admin access required.');
    }

    const branchId = await this.mobileContext.resolveBranchId(userId);

    const [totalTeachers, totalStudents, totalHalqas] = await Promise.all([
      this.prisma.teacher.count({ where: { branchId } }),
      this.prisma.student.count({ where: { branchId } }),
      this.prisma.halqa.count({ where: { branchId } }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [presentTodayCount, doneCount, pendingCount] = await Promise.all([
      this.prisma.attendance.count({
        where: {
          branchId,
          studentId: { not: null },
          status: AttendanceStatus.PRESENT,
          date: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.studentSurahProgressEntry.count({
        where: { branchId, status: { in: DONE_STATUSES } },
      }),
      this.prisma.studentSurahProgressEntry.count({
        where: { branchId, status: { notIn: DONE_STATUSES } },
      }),
    ]);

    // Legacy names this "completed today" but never actually filters by
    // date — replicated as-is (see `total_students` scoping too: legacy
    // counts *distinct students* with ≥1 done entry, not raw entry rows).
    const completedStudentIds = await this.prisma.studentSurahProgressEntry.findMany({
      where: { branchId, status: { in: DONE_STATUSES } },
      select: { studentId: true },
      distinct: ['studentId'],
    });

    const attendancePercentage = totalStudents > 0 ? Math.round((presentTodayCount / totalStudents) * 10000) / 100 : 0;
    const markedPercentage = totalStudents > 0 ? Math.round((completedStudentIds.length / totalStudents) * 10000) / 100 : 0;

    return {
      total_teachers: totalTeachers,
      total_students: totalStudents,
      total_halqas: totalHalqas,
      attendance_today: {
        present_count: presentTodayCount,
        total_students: totalStudents,
        percentage: attendancePercentage,
      },
      completion_today: {
        completed_students: completedStudentIds.length,
        total_students: totalStudents,
        percentage_marked: markedPercentage,
      },
      progress_summary: {
        pending: pendingCount,
        done: doneCount,
      },
    };
  }
}
