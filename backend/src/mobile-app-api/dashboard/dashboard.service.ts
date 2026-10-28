import { ForbiddenException, Injectable } from '@nestjs/common';
import { HifdhScheduleStatus, ProgressEntryStatus, ProgressEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileContextService } from '../common/mobile-context.service';
import { StudentSurahProgressService } from '../student-surah-progress/student-surah-progress.service';
import { GetStudentsTargetQueryDto } from '../student-surah-progress/dto/get-students-target-query.dto';

const DONE_STATUSES: ProgressEntryStatus[] = [ProgressEntryStatus.COMPLETED, ProgressEntryStatus.VERIFIED];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mobileContext: MobileContextService,
    private readonly studentSurahProgress: StudentSurahProgressService,
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

    // Students who actually achieved TODAY's scheduled target — distinct
    // from the backlog check above (which looks at every past-due row ever
    // generated, going back years). A milestone row ("Preparation day",
    // "Exam Juz X") scheduled for today still counts here: if that's what
    // was due today and it got marked done, the student met today's
    // target just as much as a student whose target was real content.
    // Milestones are only excluded from the lifetime pacing/backlog math
    // elsewhere, not from "did they do what was due today".
    const todayScheduleRows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: {
        student: { branchId },
        scheduledDate: { gte: todayStart, lte: todayEnd },
        rescheduledTo: { none: {} },
      },
      select: { studentId: true, status: true },
    });
    const studentsWithTodayTarget = new Set<string>();
    const studentsIncompleteToday = new Set<string>();
    for (const row of todayScheduleRows) {
      studentsWithTodayTarget.add(row.studentId);
      if (row.status !== HifdhScheduleStatus.COMPLETED) {
        studentsIncompleteToday.add(row.studentId);
      }
    }
    const achievedTodayCount = [...studentsWithTodayTarget].filter(
      (id) => !studentsIncompleteToday.has(id),
    ).length;

    // "Absent" — there's no attendance-marking flow for students at all
    // (no biometric check-in, no manual mark-attendance screen), so this
    // means students on an approved leave today — the one real "not
    // expected to recite today" signal that actually exists in the data.
    // leaveDate is always stored as UTC midnight (see
    // student-leaves.service.ts's dateRange/toDateOnly), so match it the
    // same way rather than against local-time todayStart/todayEnd, which
    // would drift off UTC midnight on a non-UTC server.
    const todayUtcMidnight = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const [absentStudentRows, doneCount, totalEntriesCount] = await Promise.all([
      this.prisma.studentLeave.findMany({
        where: {
          student: { branchId },
          status: 'APPROVED',
          leaveDate: todayUtcMidnight,
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
    const absentTodayCount = absentStudentRows.length;
    const pendingCount = totalEntriesCount - doneCount;

    // "Present" = everyone who isn't on leave today, regardless of
    // whether they've recited yet — not a recitation-based count. A
    // student who's shown up but hasn't marked progress yet is still
    // "present", same as a real attendance system would treat them;
    // leave is the only real "not here" signal this data actually has.
    const presentTodayCount = totalStudents - absentTodayCount;

    // Hafidh count — students who've completed every ayah of the Quran as
    // New Lesson. Uses the same sum(to) - sum(from) + count decomposition
    // as getTopStudents/targetAndActualAyahsBatch for a true per-student
    // ayah total without pulling every row into Node; trusts entries don't
    // overlap (the same assumption those call sites already make).
    const [totalQuranAyahs, newLessonAyahGroups] = await Promise.all([
      this.prisma.surah.aggregate({ _sum: { totalAyahs: true } }),
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId'],
        where: {
          branchId,
          type: ProgressEntryType.NEW_LESSON,
          status: { in: DONE_STATUSES },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        _sum: { fromAyah: true, toAyah: true },
        _count: { _all: true },
      }),
    ]);
    const quranTotalAyahs = totalQuranAyahs._sum.totalAyahs ?? 0;
    const hafidhCount = newLessonAyahGroups.filter((g) => {
      const total = (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0) + g._count._all;
      return quranTotalAyahs > 0 && total >= quranTotalAyahs;
    }).length;

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

    // How many students are genuinely AHEAD of their real cumulative
    // target overall — reuses getStudentsExceededTarget's own since_start
    // qualification (page-based, cumulative-only) so this headline number
    // always agrees with what Target Overview's "Since Start" tab shows,
    // rather than computing an independent, differently-defined metric.
    const targetQuery = new GetStudentsTargetQueryDto();
    targetQuery.to_date = new Date().toISOString().slice(0, 10);
    targetQuery.since_start = 'true';
    const exceededOverall = await this.studentSurahProgress.getStudentsExceededTarget(
      branchId,
      userId,
      targetQuery,
    );
    const targetAchievedOverallCount = exceededOverall.data.total_students_exceeded;

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
      target_achieved_overall: {
        achieved_students: targetAchievedOverallCount,
        total_students: totalStudents,
        percentage_achieved:
          totalStudents > 0
            ? Math.round((targetAchievedOverallCount / totalStudents) * 1000) / 10
            : 0,
      },
      today_target: {
        achieved_students: achievedTodayCount,
        total_students: totalStudents,
        percentage_achieved:
          totalStudents > 0
            ? Math.round((achievedTodayCount / totalStudents) * 1000) / 10
            : 0,
      },
      absent_today: absentTodayCount,
      hafidh_students_count: hafidhCount,
    };
  }
}
