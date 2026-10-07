import { ForbiddenException, Injectable } from '@nestjs/common';
import { ProgressEntryStatus } from '@prisma/client';
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
    // Only branch-wide/teacher-audience announcements — never another
    // teacher's Halqa-scoped student announcements.
    const [latestAnnouncement] = await this.prisma.announcement.findMany({
      where: { branchId: teacher.branchId, audience: { in: ['ALL', 'TEACHERS'] } },
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

    // Students with at least one overdue Hifdh schedule entry — same signal
    // as the per-student schedule screen's "Overdue" count (see
    // SurahSchedulesService.getStudentSurahSchedule's progressSummary.overdue,
    // which isn't actually month-scoped despite taking year/month params).
    // This used to be computed on the mobile app by fetching every single
    // student's own schedule individually (one request per student) and
    // counting client-side — for a branch with ~100 students that's ~100
    // concurrent requests on every dashboard load, and any of them timing
    // out under that load silently dropped that student from both the
    // numerator and denominator, making the "X / Y up to date" card show a
    // different (always-wrong, since Y never matched the real total)
    // answer on every single load. One query here replaces all of that.
    const overdueStudentRows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: {
        student: { branchId },
        status: { not: 'COMPLETED' },
        scheduledDate: { lt: todayStart },
        rescheduledTo: { none: {} },
      },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    const overdueStudentsCount = overdueStudentRows.length;

    // "Present today" used to read the Attendance table — but there's no
    // mark-attendance flow for students anywhere in the app, so that table
    // is permanently empty and this always read 0 regardless of real
    // activity. Counting distinct students with a completed lesson today
    // mirrors what the Daily Recitation Attendance report already
    // correctly shows (getFullProgressReport's "completed" bucket), so
    // this card now agrees with that report instead of silently
    // disagreeing with it.
    const [presentTodayStudentRows, doneCount, totalEntriesCount] = await Promise.all([
      this.prisma.studentSurahProgressEntry.findMany({
        where: {
          branchId,
          status: { in: DONE_STATUSES },
          completedAt: { gte: todayStart, lte: todayEnd },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.studentSurahProgressEntry.count({
        where: { branchId, status: { in: DONE_STATUSES } },
      }),
      // pending = total - done, not its own `status: { notIn: DONE_STATUSES }`
      // query — a NOT IN condition can't use the (branchId, status,
      // completedAt) index the way an IN condition can, so Postgres falls
      // back to a sequential scan. For a branch with 600K+ rows that was
      // ~520ms on its own; a plain branchId count is an index-only scan,
      // ~70ms, and pendingCount below gets the same result via subtraction.
      this.prisma.studentSurahProgressEntry.count({ where: { branchId } }),
    ]);
    const presentTodayCount = presentTodayStudentRows.length;
    const pendingCount = totalEntriesCount - doneCount;

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
      schedule_overdue: {
        overdue_students: overdueStudentsCount,
        up_to_date_students: Math.max(0, totalStudents - overdueStudentsCount),
        total_students: totalStudents,
        percentage_up_to_date:
          totalStudents > 0
            ? Math.round(((totalStudents - overdueStudentsCount) / totalStudents) * 1000) / 10
            : 0,
      },
    };
  }
}
