import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  HifdhScheduleStatus,
  NotificationType,
  ProgressEntryGrade,
  ProgressEntryStatus,
  ProgressEntryType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { MobileContextService } from '../common/mobile-context.service';
import { BulkMarkCompletedDto } from './dto/bulk-mark-completed.dto';
import { BulkMarkSurahsCompletedDto } from './dto/bulk-mark-surahs-completed.dto';
import { StoreOldLessonProgressDto } from './dto/store-old-lesson-progress.dto';
import { GetOldLessonProgressQueryDto } from './dto/get-old-lesson-progress-query.dto';
import { GetTodayProgressQueryDto } from './dto/get-today-progress-query.dto';
import { GetStudentsTargetQueryDto } from './dto/get-students-target-query.dto';
import { GetFullProgressReportQueryDto } from './dto/get-full-progress-report-query.dto';
import { GetTopStudentsQueryDto } from './dto/get-top-students-query.dto';
import { GetAttendanceReportQueryDto } from './dto/get-attendance-report-query.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { GetStudentSurahProgressQueryDto } from './dto/get-student-surah-progress-query.dto';

// ── Legacy <-> Prisma enum mapping ──────────────────────────────────────
const TYPE_TO_ENUM: Record<string, ProgressEntryType> = {
  'New Lesson': ProgressEntryType.NEW_LESSON,
  'Juzh Lesson': ProgressEntryType.JUZH_LESSON,
  'Old Lesson': ProgressEntryType.OLD_LESSON,
};
const TYPE_TO_LEGACY: Record<ProgressEntryType, string> = {
  NEW_LESSON: 'New Lesson',
  JUZH_LESSON: 'Juzh Lesson',
  OLD_LESSON: 'Old Lesson',
};
const STATUS_TO_ENUM: Record<string, ProgressEntryStatus> = {
  'Not Started': ProgressEntryStatus.NOT_STARTED,
  'In Progress': ProgressEntryStatus.IN_PROGRESS,
  Completed: ProgressEntryStatus.COMPLETED,
  Verified: ProgressEntryStatus.VERIFIED,
};
const STATUS_TO_LEGACY: Record<ProgressEntryStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  VERIFIED: 'Verified',
};
const GRADE_TO_ENUM: Record<string, ProgressEntryGrade> = {
  'Very Good': ProgressEntryGrade.VERY_GOOD,
  Good: ProgressEntryGrade.GOOD,
  Average: ProgressEntryGrade.AVERAGE,
  Bad: ProgressEntryGrade.BAD,
};
const GRADE_TO_LEGACY: Record<ProgressEntryGrade, string> = {
  VERY_GOOD: 'Very Good',
  GOOD: 'Good',
  AVERAGE: 'Average',
  BAD: 'Bad',
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'Verified':
      return 'success';
    case 'Completed':
      return 'primary';
    case 'In Progress':
      return 'warning';
    case 'Not Started':
      return 'secondary';
    default:
      return 'light';
  }
}
function gradeBadgeClass(grade: string): string {
  switch (grade) {
    case 'Very Good':
      return 'success';
    case 'Good':
      return 'primary';
    case 'Average':
      return 'warning';
    case 'Bad':
      return 'danger';
    default:
      return 'secondary';
  }
}
function fullName(
  user: { firstName: string; lastName: string | null } | null | undefined,
): string {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}
function formatDateTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
function formatDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}
/**
 * "X P & Y L" display for a real page-completion split (see
 * countPageCompletion) — used by the Center Performance Report's "New
 * Lesson" column. `pages` is a count of fully-covered physical pages
 * (each page's own real content total, not a flat 15); `lines` is
 * leftover progress on pages not yet complete — never double-counted
 * with a complete page's own lines. A 0-page result omits the "X P &"
 * prefix entirely rather than showing "0 P".
 */
function formatPagesDisplay(pages: number, lines: number): string {
  return pages > 0 ? `${pages} P & ${lines} L` : `${lines} L`;
}
// Calendar days strictly after `lastDate` up to and including `until`,
// excluding any date in `holidaySet` (branch holidays + weekly-offs, which
// are stamped onto CalendarDay.isHoliday too — see bulkSetWeekendDays /
// MasterCalendarService.publish). Mirrors days_since_last_exam's plain
// calendar-day diff, but school-days-only for the "Not Recited" tag so a
// weekend/holiday run doesn't make a student look overdue.
function countSchoolDaysSince(
  lastDate: Date,
  until: Date,
  holidaySet: Set<string | null>,
): number {
  let count = 0;
  const cursor = new Date(lastDate);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(until);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!holidaySet.has(formatDateOnly(cursor))) count++;
  }
  return count;
}
const SURAH_SELECT = {
  id: true,
  number: true,
  nameArabic: true,
  nameEnglish: true,
  totalAyahs: true,
  revelationType: true,
} satisfies Prisma.SurahSelect;

function serializeSurah(surah: {
  id: string;
  number: number;
  nameArabic: string;
  nameEnglish: string;
  totalAyahs: number;
  revelationType: string | null;
}) {
  return {
    id: surah.id,
    surah_number: surah.number,
    name_ar: surah.nameArabic,
    name_en: surah.nameEnglish,
    total_ayahs: surah.totalAyahs,
    makki_or_madani: surah.revelationType,
    place_of_revelation: surah.revelationType,
  };
}

const ENTRY_INCLUDE = {
  surah: { select: SURAH_SELECT },
  addedBy: { select: { firstName: true, lastName: true } },
  lastUpdatedBy: { select: { firstName: true, lastName: true } },
  verifiedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.StudentSurahProgressEntryInclude;

type EntryRow = Prisma.StudentSurahProgressEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

function serializeEntry(entry: EntryRow) {
  const status = STATUS_TO_LEGACY[entry.status];
  const grade = entry.grade ? GRADE_TO_LEGACY[entry.grade] : null;
  return {
    id: entry.id,
    surah_id: entry.surahId,
    from_ayah: entry.fromAyah,
    to_ayah: entry.toAyah,
    type: entry.type ? TYPE_TO_LEGACY[entry.type] : null,
    completion_status: status,
    grade,
    completed_at: formatDateTime(entry.completedAt),
    completed_at_date: formatDateOnly(entry.completedAt),
    verified_at: formatDateTime(entry.verifiedAt),
    remarks: entry.remarks,
    remark_file_url: entry.remarkFile ?? null,
    added_by: entry.addedBy
      ? { id: entry.addedById, name: fullName(entry.addedBy) }
      : null,
    last_updated_by: entry.lastUpdatedBy
      ? { id: entry.lastUpdatedById, name: fullName(entry.lastUpdatedBy) }
      : null,
    verified_by: entry.verifiedBy
      ? { id: entry.verifiedById, name: fullName(entry.verifiedBy) }
      : null,
    is_completed: status === 'Completed' || status === 'Verified',
    is_verified: status === 'Verified',
    can_complete: status === 'Not Started' || status === 'In Progress',
    status_badge_class: statusBadgeClass(status),
    grade_badge_class: grade ? gradeBadgeClass(grade) : null,
    created_at: formatDateTime(entry.createdAt),
    updated_at: formatDateTime(entry.updatedAt),
  };
}

@Injectable()
export class StudentSurahProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly context: MobileContextService,
  ) {}

  /**
   * Mirrors MobileHalqasService.index()'s scoping: a Teacher caller must
   * only ever see their own halqa's students in these branch-wide reports.
   * Returns null for non-Teacher callers (no restriction — Branch
   * Admin/Management/Super Admin see the whole branch, same as today), or
   * the (possibly empty) list of halqa ids the caller actually teaches.
   */
  private async ownHalqaIdsIfTeacher(userId: string): Promise<string[] | null> {
    const isTeacherRole = await this.context.hasRole(userId, 'Teacher');
    if (!isTeacherRole) return null;
    const ownTeacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });
    if (!ownTeacher) return [];
    const halqas = await this.prisma.halqa.findMany({
      where: { teacherId: ownTeacher.id },
      select: { id: true },
    });
    return halqas.map((h) => h.id);
  }

  /** Notifies each affected student's linked login that their recitation/Hifdh progress was updated by a teacher. */
  private async notifyProgressMarked(
    branchId: string,
    updatedCountByStudentId: Map<string, number>,
  ) {
    if (updatedCountByStudentId.size === 0) {
      return;
    }
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: [...updatedCountByStudentId.keys()] },
        userId: { not: null },
      },
      select: { id: true, userId: true },
    });
    await Promise.all(
      students.map((student) => {
        const count = updatedCountByStudentId.get(student.id) ?? 0;
        return this.notifications.notifyUser(branchId, student.userId!, {
          type: NotificationType.RECITATION_PROGRESS,
          title: 'Recitation Progress Updated',
          body: `${count} ayah(s) of your recitation were marked completed by your teacher.`,
          data: { studentId: student.id },
        });
      }),
    );
  }

  private async requireActiveStudent(branchId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, branchId, status: 'ACTIVE' },
      include: { user: { select: { email: true } } },
    });
    if (!student) {
      throw new NotFoundException({
        status: 'error',
        message: 'Student not found or inactive',
      });
    }
    return student;
  }

  /**
   * The "actual scheduled order" for a student's Surahs — comes from their
   * generated SurahHifdhStudentSchedule (day/scheduledDate), the real pacing
   * plan, not from progress-entry creation order or entry.day (the latter
   * mirrors the schedule but is only populated when entries are seeded
   * through the schedule-generation pipeline; entries created any other way
   * leave it null, silently falling back to arbitrary createdAt order).
   * Surahs with progress but no schedule row (rare — e.g. manually recorded
   * Old Lesson entries) are appended after, in their own createdAt order.
   */
  private async getScheduleOrderedSurahIds(
    studentId: string,
    fallbackSurahIds: string[],
  ): Promise<string[]> {
    const scheduleRows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: {
        studentId,
        surahId: { not: null },
        // Exclude rows superseded by a reschedule — otherwise a surah whose
        // slot was moved keeps ranking by its old, stale day/date alongside
        // the replacement row, scrambling its position relative to
        // surrounding surahs. When a schedule is regenerated for part of a
        // student's plan (bulkReschedule), this is also what correctly
        // drops the superseded generation's rows for the range that got
        // regenerated, while leaving untouched days from that same old
        // generation in place — there's no single "latest scheduleNo" that
        // works here, only "not superseded". Mirrors HifdhService.
        // listSchedules, the admin schedule view, which already filters
        // this out (see its comment).
        rescheduledTo: { none: {} },
      },
      orderBy: [
        { day: 'asc' },
        { scheduledDate: 'asc' },
        // A single day/date commonly holds several rows (e.g. a sabaq +
        // several sabqi/manzil rows, or — as with Juz Amma — a whole batch
        // of short surahs on day 1). day/scheduledDate alone don't order
        // those relative to each other, so Postgres returns them in
        // whatever order they happen to be stored, not curriculum order.
        // surahTarget.sortOrder is the master plan's own display order —
        // the same tiebreak HifdhService.listSchedules already relies on.
        { surahTarget: { sortOrder: 'asc' } },
      ],
      select: { surahId: true },
    });
    const orderedIds: string[] = [];
    for (const row of scheduleRows) {
      if (row.surahId && !orderedIds.includes(row.surahId))
        orderedIds.push(row.surahId);
    }
    for (const id of fallbackSurahIds) {
      if (!orderedIds.includes(id)) orderedIds.push(id);
    }
    return orderedIds;
  }

  private async studentHalqa(studentId: string) {
    const membership = await this.prisma.halqaStudent.findFirst({
      where: { studentId, removedAt: null },
      include: { halqa: { select: { id: true, name: true, status: true } } },
    });
    return membership?.halqa ?? null;
  }

  private async formatStudentBasic(student: {
    id: string;
    name: string;
    user: { email: string | null } | null;
    imageUrl?: string | null;
    studentCode?: string;
  }) {
    return {
      id: student.id,
      name: student.name,
      email: student.user?.email ?? null,
      student_id: student.id,
      // The actual human-facing enrollment code (e.g. "6") — student_id
      // above is the internal cuid, kept as-is since other screens already
      // rely on it for that. Optional: a couple of call sites pass a
      // narrower student shape that doesn't carry studentCode.
      student_code: student.studentCode ?? null,
      image_url: student.imageUrl ?? null,
    };
  }

  private async formatStudentWithHalqa(student: {
    id: string;
    name: string;
    user: { email: string | null } | null;
  }) {
    const base = await this.formatStudentBasic(student);
    const halqa = await this.studentHalqa(student.id);
    return {
      ...base,
      halqa: halqa
        ? { id: halqa.id, name: halqa.name, status: halqa.status.toLowerCase() }
        : null,
    };
  }

  /** Legacy computes total/completed/verified/in_progress/not_started ayah COUNTS per surah — each row is "one ayah entry" in its model, replicated verbatim here (row-count, not ayah-range width). */
  private async getSurahStatistics(studentId: string, surahId: string) {
    const [total, completed, verified, inProgress, notStarted] =
      await Promise.all([
        this.prisma.studentSurahProgressEntry.count({
          where: { studentId, surahId },
        }),
        this.prisma.studentSurahProgressEntry.count({
          where: { studentId, surahId, status: 'COMPLETED' },
        }),
        this.prisma.studentSurahProgressEntry.count({
          where: { studentId, surahId, status: 'VERIFIED' },
        }),
        this.prisma.studentSurahProgressEntry.count({
          where: { studentId, surahId, status: 'IN_PROGRESS' },
        }),
        this.prisma.studentSurahProgressEntry.count({
          where: { studentId, surahId, status: 'NOT_STARTED' },
        }),
      ]);
    const totalCompleted = completed + verified;
    const completionRate =
      total > 0 ? Math.round((totalCompleted / total) * 1000) / 10 : 0;
    return {
      total_ayahs: total,
      completed_ayahs: completed,
      verified_ayahs: verified,
      in_progress_ayahs: inProgress,
      not_started_ayahs: notStarted,
      total_completed: totalCompleted,
      completion_rate: completionRate,
      is_surah_completed: total > 0 && totalCompleted >= total,
    };
  }

  private typeWhere(type?: string): Prisma.StudentSurahProgressEntryWhereInput {
    if (!type) return {};
    return { OR: [{ type: TYPE_TO_ENUM[type] }, { type: null }] };
  }

  // ── getSurahDetails ─────────────────────────────────────────────────
  async getSurahDetails(
    branchId: string,
    surahId: string,
    studentId: string,
    type?: string,
  ) {
    const student = await this.requireActiveStudent(branchId, studentId);
    const surah = await this.prisma.surah.findUnique({
      where: { id: surahId },
      select: SURAH_SELECT,
    });
    if (!surah) {
      throw new NotFoundException({
        status: 'error',
        message: 'Surah not found',
      });
    }

    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: { studentId, surahId, ...this.typeWhere(type) },
      include: ENTRY_INCLUDE,
      // day (the master target schedule's day-number, null for entries not
      // seeded from it) reflects actual pacing-plan order; fromAyah is the
      // tiebreak for same-day entries.
      orderBy: [{ day: 'asc' }, { fromAyah: 'asc' }],
    });
    const serialized = entries.map(serializeEntry);

    const completed = serialized.filter((e) => e.completed_at !== null);
    const notCompleted = serialized.filter((e) => e.completed_at === null);

    const byDate = new Map<string, typeof serialized>();
    for (const entry of completed) {
      const date = entry.completed_at_date!;
      const list = byDate.get(date) ?? [];
      list.push(entry);
      byDate.set(date, list);
    }
    const sortedDates = [...byDate.keys()].sort().reverse();
    const groupedProgress: {
      completed_at: string | null;
      entries: unknown[];
    }[] = sortedDates.map((date) => ({
      completed_at: date,
      entries: byDate.get(date)!,
    }));
    if (notCompleted.length > 0) {
      groupedProgress.push({ completed_at: null, entries: notCompleted });
    }

    return {
      status: 'success',
      data: {
        student: await this.formatStudentWithHalqa(student),
        surah: serializeSurah(surah),
        progress_entries: groupedProgress,
        statistics: await this.getSurahStatistics(studentId, surahId),
      },
    };
  }

  // ── getSurahProgressList ────────────────────────────────────────────
  async getSurahProgressList(
    branchId: string,
    studentId: string,
    type?: string,
  ) {
    const student = await this.requireActiveStudent(branchId, studentId);

    const allRecords = await this.prisma.studentSurahProgressEntry.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
      select: { surahId: true },
    });
    const fallbackSurahIds: string[] = [];
    for (const r of allRecords) {
      if (r.surahId && !fallbackSurahIds.includes(r.surahId))
        fallbackSurahIds.push(r.surahId);
    }
    const orderedSurahIds = await this.getScheduleOrderedSurahIds(
      studentId,
      fallbackSurahIds,
    );

    const surahs = await this.prisma.surah.findMany({
      where: { id: { in: orderedSurahIds } },
      select: SURAH_SELECT,
    });
    const surahById = new Map(surahs.map((s) => [s.id, s]));
    const orderedSurahs = orderedSurahIds
      .map((id) => surahById.get(id))
      .filter((s): s is NonNullable<typeof s> => !!s);

    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: { studentId, ...this.typeWhere(type) },
    });

    // Ayah -> Mushaf-line-count lookup, so progress is weighted by how much
    // was actually memorized (lines) rather than by raw ayah/entry count —
    // some ayahs are one line, others span several, and surahs vary hugely
    // in length (An-Nas: 6 short ayahs vs. Al-Baqarah: 286 ayahs).
    const pageLines = await this.prisma.surahAyahPageLine.findMany({
      where: { surahId: { in: orderedSurahIds } },
      select: { surahId: true, ayahNumber: true, lineFrom: true, lineTo: true },
    });
    const lineCountOf = new Map<string, number>(); // `${surahId}:${ayahNumber}` -> lines
    for (const pl of pageLines) {
      lineCountOf.set(
        `${pl.surahId}:${pl.ayahNumber}`,
        pl.lineTo - pl.lineFrom + 1,
      );
    }
    // Entries without a concrete ayah range (e.g. some Old Lesson rows) fall
    // back to a weight of 1 line so they still count, just without the
    // length-weighting benefit.
    function linesFor(
      surahId: string | null,
      fromAyah: number | null,
      toAyah: number | null,
    ): number {
      if (!surahId || fromAyah === null || toAyah === null) return 1;
      let lines = 0;
      for (let ayah = fromAyah; ayah <= toAyah; ayah++) {
        lines += lineCountOf.get(`${surahId}:${ayah}`) ?? 1;
      }
      return lines || 1;
    }

    const progressMap = new Map<
      string,
      {
        total: number;
        completed: number;
        inProgress: number;
        notStarted: number;
        totalLines: number;
        completedLines: number;
        types: Set<string>;
      }
    >();
    for (const e of entries) {
      if (!e.surahId) continue;
      const entry = progressMap.get(e.surahId) ?? {
        total: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        totalLines: 0,
        completedLines: 0,
        types: new Set<string>(),
      };
      const lines = linesFor(e.surahId, e.fromAyah, e.toAyah);
      entry.total += 1;
      entry.totalLines += lines;
      if (e.type) entry.types.add(TYPE_TO_LEGACY[e.type]);
      if (e.status === 'COMPLETED' || e.status === 'VERIFIED') {
        entry.completed += 1;
        entry.completedLines += lines;
      } else if (e.status === 'IN_PROGRESS') entry.inProgress += 1;
      else if (e.status === 'NOT_STARTED') entry.notStarted += 1;
      progressMap.set(e.surahId, entry);
    }

    const surahList = orderedSurahs.map((surah) => {
      const data = progressMap.get(surah.id);
      let completionStatus = 'Not Started';
      let progressPercentage = 0;
      let types: string[] = [];
      if (data) {
        types = [...data.types];
        if (data.completed === data.total && data.total > 0) {
          completionStatus = 'Completed';
          progressPercentage = 100;
        } else if (data.completed > 0 || data.inProgress > 0) {
          completionStatus = 'In Progress';
          progressPercentage =
            data.totalLines > 0
              ? Math.round((data.completedLines / data.totalLines) * 10000) /
                100
              : 0;
        }
      }
      const displayType =
        type ?? (types.length > 0 ? types.join(', ') : 'No lessons');

      return {
        surah_id: surah.id,
        surah_number: surah.number,
        surah_name_ar: surah.nameArabic,
        surah_name_en: surah.nameEnglish,
        total_ayahs: surah.totalAyahs,
        makki_or_madani: surah.revelationType,
        place_of_revelation: surah.revelationType,
        type: displayType,
        types,
        completion_status: completionStatus,
        progress_percentage: progressPercentage,
        status_badge_class: statusBadgeClass(completionStatus),
        total_entries: data?.total ?? 0,
        completed_entries: data?.completed ?? 0,
        in_progress_entries: data?.inProgress ?? 0,
        not_started_entries: data?.notStarted ?? 0,
      };
    });

    const totalSurahs = orderedSurahs.length;
    const completedSurahs = surahList.filter(
      (s) => s.completion_status === 'Completed',
    ).length;
    const inProgressSurahs = surahList.filter(
      (s) => s.completion_status === 'In Progress',
    ).length;
    const notStartedSurahs = surahList.filter(
      (s) => s.completion_status === 'Not Started',
    ).length;
    // Line-weighted overall percentage — NOT completedSurahs/totalSurahs,
    // which would count a 6-ayah surah the same as a 286-ayah one.
    let totalLinesAll = 0;
    let completedLinesAll = 0;
    for (const data of progressMap.values()) {
      totalLinesAll += data.totalLines;
      completedLinesAll += data.completedLines;
    }
    const overallProgress =
      totalLinesAll > 0
        ? Math.round((completedLinesAll / totalLinesAll) * 10000) / 100
        : 0;

    const pacing = await this.computeSchedulePacing(studentId, lineCountOf);

    return {
      status: 'success',
      data: {
        student: await this.formatStudentWithHalqa(student),
        surahs: surahList,
        statistics: {
          total_surahs: totalSurahs,
          completed_surahs: completedSurahs,
          in_progress_surahs: inProgressSurahs,
          not_started_surahs: notStartedSurahs,
          overall_progress_percentage: overallProgress,
          actual_progress_percentage: pacing.actualProgressPercentage,
          expected_progress_percentage: pacing.expectedProgressPercentage,
          target_completion_date: pacing.targetCompletionDate,
          projected_completion_date: pacing.projectedCompletionDate,
          pace_status: pacing.paceStatus,
          pace_message: pacing.paceMessage,
        },
        filter_applied: { type: type ?? null },
      },
    };
  }

  /**
   * Schedule-based pacing: how much of the student's Hifdh schedule SHOULD
   * be done by today (by scheduled date) vs. how much actually IS done (by
   * SurahHifdhStudentSchedule.status, which syncScheduleEntries() keeps in
   * sync with progress marking), plus when they're on track to finish vs.
   * when the schedule says they should. All line-weighted, same as the
   * surah list above, so a 6-ayah surah doesn't count the same as a
   * 286-ayah one.
   */
  private async computeSchedulePacing(
    studentId: string,
    lineCountOf: Map<string, number>,
  ) {
    const latestScheduleNoAgg =
      await this.prisma.surahHifdhStudentSchedule.aggregate({
        where: { studentId },
        _max: { scheduleNo: true },
      });
    const scheduleNo = latestScheduleNoAgg._max.scheduleNo;
    if (!scheduleNo) {
      return {
        actualProgressPercentage: 0,
        expectedProgressPercentage: 0,
        targetCompletionDate: null as string | null,
        projectedCompletionDate: null as string | null,
        paceStatus: 'no_schedule',
        paceMessage: 'No schedule generated for this student yet',
        totalLines: 0,
        actualLines: 0,
        expectedLines: 0,
        remainingLines: 0,
        currentDailyPace: null as number | null,
        requiredDailyPace: null as number | null,
      };
    }

    // The student's current plan can span multiple scheduleNo generations
    // when only part of it was ever regenerated (bulkReschedule) —
    // rescheduledTo: {none: {}} is the correct "not superseded" filter
    // (mirrors getScheduleOrderedSurahIds and getStudentSurahSchedule's own
    // fix for the same issue), not "only the single highest scheduleNo",
    // which silently dropped every row from an earlier generation the
    // regeneration never touched — making a student with lots of real,
    // already-marked progress on those surahs look 0% / "not started".
    const rows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: { studentId, rescheduledTo: { none: {} } },
      select: {
        surahId: true,
        fromAyah: true,
        toAyah: true,
        scheduledDate: true,
        status: true,
        completedAt: true,
      },
    });

    // lineCountOf was built from the New Lesson surahs only — schedule rows
    // can reference surahs outside that set (e.g. after a curriculum
    // restart), so top up any missing surah's ayah/line data on demand.
    const missingSurahIds = [
      ...new Set(rows.map((r) => r.surahId).filter((id): id is string => !!id)),
    ].filter(
      (id) => ![...lineCountOf.keys()].some((k) => k.startsWith(`${id}:`)),
    );
    if (missingSurahIds.length > 0) {
      const extra = await this.prisma.surahAyahPageLine.findMany({
        where: { surahId: { in: missingSurahIds } },
        select: {
          surahId: true,
          ayahNumber: true,
          lineFrom: true,
          lineTo: true,
        },
      });
      for (const pl of extra)
        lineCountOf.set(
          `${pl.surahId}:${pl.ayahNumber}`,
          pl.lineTo - pl.lineFrom + 1,
        );
    }

    const linesForRow = (
      surahId: string | null,
      fromAyah: number | null,
      toAyah: number | null,
    ): number => {
      if (!surahId || fromAyah === null || toAyah === null) return 1;
      let lines = 0;
      for (let ayah = fromAyah; ayah <= toAyah; ayah++)
        lines += lineCountOf.get(`${surahId}:${ayah}`) ?? 1;
      return lines || 1;
    };

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Pace is measured over a trailing window (see PACE_WINDOW_DAYS below),
    // not the student's entire history — a lifetime average never forgets
    // a one-time bulk-marked backlog, so it can read as "unusually fast"
    // for as long as that backlog stays a large share of the total (weeks
    // to months, depending on size). A trailing window bounds that to the
    // window length: once the bulk day ages out of it, pace reflects only
    // recent real activity.
    const PACE_WINDOW_DAYS = 14;
    const windowStart = new Date(today.getTime() - PACE_WINDOW_DAYS * 86400000);

    let totalLines = 0;
    let actualLines = 0;
    let expectedLines = 0;
    let latestDate: Date | null = null;
    // Still tracked across the student's whole history (not just the pace
    // window) — used for the "ever marked anything" / "gone quiet" checks
    // below, which are about lifetime activity, not recent pace.
    let earliestCompletedAt: Date | null = null;
    let latestCompletedAt: Date | null = null;
    // Lines actually completed within the trailing window — this, not
    // actualLines, drives the pace/projection calculation.
    let windowLines = 0;

    for (const row of rows) {
      // Milestone rows ("Preparation day", "Exam Juz X") carry no surah/
      // ayah content — they're revision/exam checkpoints, not
      // memorization itself. The historical backfill that marks real
      // memorization COMPLETED never touches these (nothing for it to
      // match against), so a student who's genuinely 100% done
      // memorizing would otherwise sit stuck at a non-100% percentage
      // forever because of their own still-pending exam checkpoints.
      // Excluded from the percentage/pace math entirely; still counted
      // toward `latestDate` below, since the schedule's real end date
      // legitimately includes the final exam day.
      if (!row.surahId) {
        if (!latestDate || row.scheduledDate > latestDate)
          latestDate = row.scheduledDate;
        continue;
      }
      const lines = linesForRow(row.surahId, row.fromAyah, row.toAyah);
      totalLines += lines;
      if (row.status === HifdhScheduleStatus.COMPLETED) {
        actualLines += lines;
        if (row.completedAt) {
          if (!earliestCompletedAt || row.completedAt < earliestCompletedAt) {
            earliestCompletedAt = row.completedAt;
          }
          if (!latestCompletedAt || row.completedAt > latestCompletedAt) {
            latestCompletedAt = row.completedAt;
          }
          if (row.completedAt >= windowStart) windowLines += lines;
        }
      }
      if (row.scheduledDate <= today) expectedLines += lines;
      if (!latestDate || row.scheduledDate > latestDate)
        latestDate = row.scheduledDate;
    }

    const actualProgressPercentage =
      totalLines > 0 ? Math.round((actualLines / totalLines) * 10000) / 100 : 0;
    const expectedProgressPercentage =
      totalLines > 0
        ? Math.round((expectedLines / totalLines) * 10000) / 100
        : 0;
    const targetCompletionDate = latestDate ? formatDateOnly(latestDate) : null;
    const remainingLines = Math.max(0, totalLines - actualLines);
    // How many lines/day, starting today, would actually close the gap by
    // the schedule's own target date — distinct from currentDailyPace
    // (how fast they're ACTUALLY going), so the UI can show both side by
    // side: "doing 3/day, needs 5/day to hit the target".
    const requiredDailyPace = latestDate
      ? remainingLines /
        Math.max(1, Math.round((latestDate.getTime() - today.getTime()) / 86400000))
      : null;

    // Project a finish date from the student's own actual pace over the
    // trailing window — lines completed within it ÷ days elapsed within
    // it. A raw extrapolation here can produce nonsense (a projection
    // centuries out for someone who's barely started, or an implausibly
    // fast one if a backlog got bulk-marked with the same timestamp) —
    // those aren't useful dates, they're noise, so below we classify the
    // estimate's reliability and only hand back a date when it's actually
    // meaningful. Otherwise the caller gets a status + plain-language
    // reason instead of a number that looks broken.
    const MAX_PLAUSIBLE_LINES_PER_DAY = 50; // generous ceiling for real daily memorization pace — a genuine data-quality guard, not a "too surprising" filter
    const INACTIVE_AFTER_DAYS = 30; // schedule rows are daily with no built-in rest days, so any sustained gap is a real gap

    let projectedCompletionDate: string | null = null;
    let paceStatus: string;
    let paceMessage: string;
    let currentDailyPace: number | null = null;

    const daysSinceLastActivity = latestCompletedAt
      ? Math.round((today.getTime() - latestCompletedAt.getTime()) / 86400000)
      : null;

    if (actualLines === 0) {
      paceStatus = 'not_started';
      paceMessage = 'No lessons marked yet for this schedule';
    } else if (
      daysSinceLastActivity !== null &&
      daysSinceLastActivity >= INACTIVE_AFTER_DAYS
    ) {
      // Takes priority over the checks below — a stale pace from before a
      // long gap isn't a meaningful projection regardless of how much
      // total history exists.
      paceStatus = 'inactive';
      paceMessage = `No activity in the last ${daysSinceLastActivity} days`;
    } else if (!earliestCompletedAt) {
      // Schedule rows are COMPLETED but carry no completedAt at all —
      // shouldn't happen via normal marking, flag rather than guess.
      paceStatus = 'unmarked_dates';
      paceMessage =
        'Completed lessons are missing dates — marking may need review';
    } else if (windowLines === 0) {
      // Something was marked at some point (actualLines > 0) and they're
      // not yet "inactive" (< 30 days since last activity), but nothing
      // fell inside the shorter pace window — e.g. a bulk-marked backlog
      // that's since aged out of it with no new marking yet. Distinct from
      // both "not_started" and "inactive": there's history, just not
      // enough *recent* history to estimate a current pace from.
      paceStatus = 'insufficient_recent_activity';
      paceMessage = `No lessons marked in the last ${PACE_WINDOW_DAYS} days to estimate current pace`;
    } else {
      // Capped by how long the student has actually been active, so a
      // student who started within the window isn't diluted by days
      // before they existed (e.g. a 3-day-old student's pace is measured
      // over 3 days, not artificially spread across the full window).
      const daysSinceFirstEver = Math.max(
        1,
        Math.round(
          (today.getTime() - earliestCompletedAt.getTime()) / 86400000,
        ) + 1,
      );
      const daysElapsed = Math.min(PACE_WINDOW_DAYS, daysSinceFirstEver);
      const linesPerDay = windowLines / daysElapsed;
      currentDailyPace = Math.round(linesPerDay * 100) / 100;

      if (linesPerDay > MAX_PLAUSIBLE_LINES_PER_DAY) {
        paceStatus = 'unrealistic_pace';
        paceMessage = 'Recent marking looks unusually fast — may need review';
      } else {
        // Now that pace is measured from real recent practice, a far-out
        // date is genuinely correct information for a slow-but-real
        // student, not noise to hide — so it's shown as an actual date
        // rather than a vague "far behind" placeholder. The UI compares it
        // against the target date itself to label how far ahead/behind
        // that implies.
        const daysToFinish = Math.ceil(remainingLines / linesPerDay);
        const projected = new Date(today.getTime() + daysToFinish * 86400000);
        projectedCompletionDate = formatDateOnly(projected);
        paceStatus = 'on_track';
        paceMessage = '';
      }
    }

    return {
      actualProgressPercentage,
      expectedProgressPercentage,
      targetCompletionDate,
      projectedCompletionDate,
      paceStatus,
      totalLines,
      actualLines,
      expectedLines,
      remainingLines,
      currentDailyPace,
      requiredDailyPace: requiredDailyPace !== null ? Math.round(requiredDailyPace * 100) / 100 : null,
      paceMessage,
    };
  }

  // ── getStudentTargetDetail ───────────────────────────────────────────
  /**
   * Full detail behind a Target Overview card tap: current vs expected
   * progress in real pages/lines/Juz' (not the abstract "lines" scalar
   * computeSchedulePacing uses internally for its own pace math — see
   * countPageCompletion's doc comment for why that distinction matters),
   * current vs required daily pace to hit the schedule's own target date,
   * and the last New Lesson actually marked.
   */
  async getStudentTargetDetail(branchId: string, userId: string, studentId: string) {
    const student = await this.requireActiveStudent(branchId, studentId);
    const pacing = await this.computeSchedulePacing(studentId, new Map());

    const scheduleRows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: {
        studentId,
        rescheduledTo: { none: {} },
        surahId: { not: null },
        fromAyah: { not: null },
        toAyah: { not: null },
      },
      select: { surahId: true, fromAyah: true, toAyah: true, status: true, scheduledDate: true },
    });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [completedCompletion, expectedCompletion] = await Promise.all([
      this.countPageCompletion(
        scheduleRows
          .filter((r) => r.status === 'COMPLETED')
          .map((r) => ({
            groupKey: 'completed',
            surahId: r.surahId!,
            fromAyah: r.fromAyah!,
            toAyah: r.toAyah!,
          })),
      ),
      this.countPageCompletion(
        scheduleRows
          .filter((r) => r.scheduledDate <= today)
          .map((r) => ({
            groupKey: 'expected',
            surahId: r.surahId!,
            fromAyah: r.fromAyah!,
            toAyah: r.toAyah!,
          })),
      ),
    ]);
    const actualPages = completedCompletion.pages.get('completed') ?? 0;
    const actualLines = completedCompletion.lines.get('completed') ?? 0;
    const expectedPages = expectedCompletion.pages.get('expected') ?? 0;
    const expectedLines = expectedCompletion.lines.get('expected') ?? 0;
    const actualSplit = this.splitPagesIntoJuzAndPages(actualPages);
    const expectedSplit = this.splitPagesIntoJuzAndPages(expectedPages);

    const lastNewLesson = await this.prisma.studentSurahProgressEntry.findFirst({
      where: {
        studentId,
        type: TYPE_TO_ENUM['New Lesson'],
        status: { in: ['COMPLETED', 'VERIFIED'] },
      },
      include: { surah: { select: SURAH_SELECT } },
      orderBy: { completedAt: 'desc' },
    });

    const halqaMembership = await this.prisma.halqaStudent.findFirst({
      where: { studentId, removedAt: null },
      include: {
        halqa: {
          include: {
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    const classByStudent = await this.studentCurrentClassBatch([studentId]);

    return {
      status: 'success',
      data: {
        student: {
          ...(await this.formatStudentBasic(student)),
          halqa: halqaMembership?.halqa
            ? { id: halqaMembership.halqa.id, name: halqaMembership.halqa.name }
            : null,
          teacher_name: halqaMembership?.halqa.teacher
            ? fullName(halqaMembership.halqa.teacher.user)
            : null,
          class_name: classByStudent.get(studentId) ?? null,
        },
        actual_progress: {
          percentage: pacing.actualProgressPercentage,
          pages: actualPages,
          lines: actualLines,
          juz: actualSplit.juz,
          pages_remainder: actualSplit.pages,
        },
        expected_progress: {
          percentage: pacing.expectedProgressPercentage,
          pages: expectedPages,
          lines: expectedLines,
          juz: expectedSplit.juz,
          pages_remainder: expectedSplit.pages,
        },
        pace: {
          status: pacing.paceStatus,
          message: pacing.paceMessage,
          current_daily_lines: pacing.currentDailyPace,
          required_daily_lines: pacing.requiredDailyPace,
          remaining_lines: pacing.remainingLines,
          target_completion_date: pacing.targetCompletionDate,
          projected_completion_date: pacing.projectedCompletionDate,
        },
        last_new_lesson: lastNewLesson
          ? {
              completed_at: lastNewLesson.completedAt
                ? formatDateOnly(lastNewLesson.completedAt)
                : null,
              surah: lastNewLesson.surah ? serializeSurahBasic(lastNewLesson.surah) : null,
              from_ayah: lastNewLesson.fromAyah,
              to_ayah: lastNewLesson.toAyah,
            }
          : null,
      },
    };
  }

  /**
   * Batched actual%/expected% pacing for many students at once (one
   * findMany instead of N single-student queries) — used by
   * getCenterPerformanceReport, which can span 100+ students in a branch.
   * Deliberately only replicates computeSchedulePacing's actual%/expected%
   * math (same rows filter, same lineCountOf build, same
   * `status === COMPLETED` / `scheduledDate <= today` semantics, same
   * rounding), not its pace-projection/target-date logic, which this report
   * doesn't need. When a student has no non-superseded schedule rows at
   * all, totalLines stays 0 and both percentages fall out to 0 — identical
   * to computeSchedulePacing's own "no schedule" early-return result, so no
   * separate short-circuit is needed here.
   */
  private async computeSchedulePacingBatch(
    studentIds: string[],
  ): Promise<
    Map<string, { actualProgressPercentage: number; expectedProgressPercentage: number }>
  > {
    const result = new Map<
      string,
      { actualProgressPercentage: number; expectedProgressPercentage: number }
    >();
    if (studentIds.length === 0) return result;

    const rows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: { studentId: { in: studentIds }, rescheduledTo: { none: {} } },
      select: {
        studentId: true,
        surahId: true,
        fromAyah: true,
        toAyah: true,
        scheduledDate: true,
        status: true,
        completedAt: true,
      },
    });

    // Same ayah -> Mushaf-line-count lookup as computeSchedulePacing builds
    // (and getSurahProgressList's own lineCountOf before it), scaled to
    // every surah referenced across all these students' schedule rows.
    const referencedSurahIds = [
      ...new Set(rows.map((r) => r.surahId).filter((id): id is string => !!id)),
    ];
    const pageLines = referencedSurahIds.length
      ? await this.prisma.surahAyahPageLine.findMany({
          where: { surahId: { in: referencedSurahIds } },
          select: { surahId: true, ayahNumber: true, lineFrom: true, lineTo: true },
        })
      : [];
    const lineCountOf = new Map<string, number>();
    for (const pl of pageLines) {
      lineCountOf.set(`${pl.surahId}:${pl.ayahNumber}`, pl.lineTo - pl.lineFrom + 1);
    }

    const linesForRow = (
      surahId: string | null,
      fromAyah: number | null,
      toAyah: number | null,
    ): number => {
      if (!surahId || fromAyah === null || toAyah === null) return 1;
      let lines = 0;
      for (let ayah = fromAyah; ayah <= toAyah; ayah++)
        lines += lineCountOf.get(`${surahId}:${ayah}`) ?? 1;
      return lines || 1;
    };

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const rowsByStudent = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = rowsByStudent.get(row.studentId) ?? [];
      list.push(row);
      rowsByStudent.set(row.studentId, list);
    }

    for (const studentId of studentIds) {
      const studentRows = rowsByStudent.get(studentId) ?? [];
      let totalLines = 0;
      let actualLines = 0;
      let expectedLines = 0;
      for (const row of studentRows) {
        // Milestone rows ("Preparation day", "Exam Juz X") carry no
        // surah/ayah content and are never touched by the historical
        // backfill — see computeSchedulePacing's identical exclusion for
        // the full reasoning. Excluded here too so a student who's
        // genuinely 100% done memorizing isn't graded down for their own
        // still-pending exam checkpoints.
        if (!row.surahId) continue;
        const lines = linesForRow(row.surahId, row.fromAyah, row.toAyah);
        totalLines += lines;
        if (row.status === HifdhScheduleStatus.COMPLETED) actualLines += lines;
        if (row.scheduledDate <= today) expectedLines += lines;
      }
      const actualProgressPercentage =
        totalLines > 0 ? Math.round((actualLines / totalLines) * 10000) / 100 : 0;
      const expectedProgressPercentage =
        totalLines > 0 ? Math.round((expectedLines / totalLines) * 10000) / 100 : 0;
      result.set(studentId, { actualProgressPercentage, expectedProgressPercentage });
    }
    return result;
  }

  // ── determineTargetSurah / getNextSurah / getLogicExplanation ───────
  private async getOrderedSurahIds(studentId: string): Promise<string[]> {
    const rows = await this.prisma.studentSurahProgressEntry.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
      select: { surahId: true },
    });
    const fallbackIds: string[] = [];
    for (const r of rows) {
      if (r.surahId && !fallbackIds.includes(r.surahId))
        fallbackIds.push(r.surahId);
    }
    return this.getScheduleOrderedSurahIds(studentId, fallbackIds);
  }

  private async determineTargetSurah(
    studentId: string,
    requestedSurahId?: string,
  ): Promise<string | null> {
    if (requestedSurahId) return requestedSurahId;
    const orderedSurahIds = await this.getOrderedSurahIds(studentId);
    if (orderedSurahIds.length === 0) return null;
    for (const surahId of orderedSurahIds) {
      const stats = await this.getSurahStatistics(studentId, surahId);
      if (!stats.is_surah_completed) return surahId;
    }
    return orderedSurahIds[orderedSurahIds.length - 1];
  }

  /** Legacy's own (unusual) "next surah" logic: wraps 1 -> 114, otherwise steps backwards through surah_number. Replicated verbatim. */
  private async getNextSurah(currentSurahId: string) {
    const current = await this.prisma.surah.findUnique({
      where: { id: currentSurahId },
      select: { number: true },
    });
    if (!current) return null;
    if (current.number === 1) {
      return this.prisma.surah.findFirst({
        where: { number: 114 },
        select: SURAH_SELECT,
      });
    }
    return this.prisma.surah.findFirst({
      where: { number: { lt: current.number } },
      orderBy: { number: 'desc' },
      select: SURAH_SELECT,
    });
  }

  private async getLogicExplanation(
    studentId: string,
    requestedSurahId?: string,
  ) {
    if (requestedSurahId) {
      return {
        determined_by: 'requested_surah_id',
        description: 'Surah was explicitly requested via surah_id parameter',
      };
    }
    const lastCompleted = await this.prisma.studentSurahProgressEntry.findFirst(
      {
        where: { studentId, status: { in: ['COMPLETED', 'VERIFIED'] } },
        orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }],
      },
    );
    if (!lastCompleted || !lastCompleted.surahId) {
      return {
        determined_by: 'first_available_surah',
        description:
          'No completed ayahs found, returned first Surah with any progress',
      };
    }
    const [total, completedCount] = await Promise.all([
      this.prisma.studentSurahProgressEntry.count({
        where: { studentId, surahId: lastCompleted.surahId },
      }),
      this.prisma.studentSurahProgressEntry.count({
        where: {
          studentId,
          surahId: lastCompleted.surahId,
          status: { in: ['COMPLETED', 'VERIFIED'] },
        },
      }),
    ]);
    if (total > 0 && completedCount >= total) {
      return {
        determined_by: 'next_surah_logic',
        description:
          'All ayahs of the last completed Surah are finished, returned next Surah in sequence',
      };
    }
    return {
      determined_by: 'last_completed_surah',
      description:
        'Returned the Surah containing the most recently completed ayah',
    };
  }

  // ── getStudentSurahProgress ─────────────────────────────────────────
  async getStudentSurahProgress(
    branchId: string,
    studentId: string,
    query: GetStudentSurahProgressQueryDto,
  ) {
    const student = await this.requireActiveStudent(branchId, studentId);

    const targetSurahId = await this.determineTargetSurah(
      studentId,
      query.surah_id,
    );
    if (!targetSurahId) {
      throw new NotFoundException({
        status: 'error',
        message: 'No Surah progress found for this student',
      });
    }
    const targetSurah = await this.prisma.surah.findUnique({
      where: { id: targetSurahId },
      select: SURAH_SELECT,
    });
    if (!targetSurah) {
      throw new NotFoundException({
        status: 'error',
        message: 'Target Surah not found',
      });
    }

    const surahStats = await this.getSurahStatistics(studentId, targetSurahId);

    let nextSurahData: {
      id: string;
      surah_number: number;
      name_ar: string;
      name_en: string;
      total_ayahs: number;
    } | null = null;
    if (surahStats.is_surah_completed) {
      const nextSurah = await this.getNextSurah(targetSurah.id);
      nextSurahData = nextSurah
        ? {
            id: nextSurah.id,
            surah_number: nextSurah.number,
            name_ar: nextSurah.nameArabic,
            name_en: nextSurah.nameEnglish,
            total_ayahs: nextSurah.totalAyahs,
          }
        : null;
    }

    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: {
        studentId,
        surahId: targetSurahId,
        ...this.typeWhere(query.type),
      },
      include: ENTRY_INCLUDE,
      // Legacy orders by a join to surah_target_schedules(surah_number, day)
      // then from_ayah; mirrored here via the entry's own `day` column
      // (copied from that schedule at seed time) with from_ayah as tiebreak.
      orderBy: [{ day: 'asc' }, { fromAyah: 'asc' }],
    });

    return {
      status: 'success',
      data: {
        student: await this.formatStudentWithHalqa(student),
        surah: serializeSurah(targetSurah),
        next_surah: nextSurahData,
        progress_entries: entries.map(serializeEntry),
        statistics: surahStats,
        logic_applied: await this.getLogicExplanation(
          studentId,
          query.surah_id,
        ),
      },
    };
  }

  // ── bulkMarkCompleted ────────────────────────────────────────────────
  /**
   * Reverse of HifdhService.syncProgressEntries (academic/hifdh/hifdh.service.ts,
   * which pushes a schedule-row completion onto its matching progress
   * entries). Without this, marking "New Lesson" progress from the mobile
   * app never resolved the matching schedule row — only the web portal's
   * Schedule-tab "Mark Completed" button did — so a student could hit their
   * target in the app and still show up as overdue everywhere that reads
   * SurahHifdhStudentSchedule.status.
   *
   * A schedule row is resolved once every NEW_LESSON progress entry within
   * its ayah range is COMPLETED/VERIFIED — not as soon as any single one is,
   * since one schedule row can cover several per-ayah progress entries.
   */
  private async syncScheduleEntries(
    tx: Prisma.TransactionClient,
    studentId: string,
    surahIds: string[],
  ) {
    const uniqueSurahIds = [...new Set(surahIds)];
    if (uniqueSurahIds.length === 0) return;

    const candidates = await tx.surahHifdhStudentSchedule.findMany({
      where: {
        studentId,
        surahId: { in: uniqueSurahIds },
        status: { not: HifdhScheduleStatus.COMPLETED },
        fromAyah: { not: null },
        toAyah: { not: null },
      },
    });

    for (const schedule of candidates) {
      if (schedule.fromAyah === null || schedule.toAyah === null) continue;
      const coveringEntries = await tx.studentSurahProgressEntry.findMany({
        where: {
          studentId,
          surahId: schedule.surahId,
          type: ProgressEntryType.NEW_LESSON,
          fromAyah: { gte: schedule.fromAyah, lte: schedule.toAyah },
        },
        select: { status: true, completedAt: true },
      });
      const fullyCovered =
        coveringEntries.length > 0 &&
        coveringEntries.every(
          (e) =>
            e.status === ProgressEntryStatus.COMPLETED ||
            e.status === ProgressEntryStatus.VERIFIED,
        );
      if (fullyCovered) {
        // Use the real completion time of the last-finished covering ayah,
        // not "now" — this can run retroactively (e.g. the first time this
        // sync existed, against a student's whole prior history), and
        // stamping "now" would make every historical completion look like
        // it happened today, which throws off pace/projection math that
        // reads completedAt.
        const completedAt =
          coveringEntries.reduce<Date | null>((latest, e) => {
            if (!e.completedAt) return latest;
            return !latest || e.completedAt > latest ? e.completedAt : latest;
          }, null) ?? new Date();
        await tx.surahHifdhStudentSchedule.update({
          where: { id: schedule.id },
          data: {
            status: HifdhScheduleStatus.COMPLETED,
            completedAt,
            completionDate: completedAt,
          },
        });
      }
    }
  }

  /**
   * Reverse of syncScheduleEntries() — when a progress entry that was
   * backing a schedule row's completion gets unmarked, the schedule row
   * needs to revert too, or it stays falsely "completed" (and out of the
   * overdue/pending counts) forever even though nothing is actually done.
   */
  private async unsyncScheduleEntries(
    tx: Prisma.TransactionClient,
    studentId: string,
    surahIds: string[],
  ) {
    const uniqueSurahIds = [...new Set(surahIds)];
    if (uniqueSurahIds.length === 0) return;

    const candidates = await tx.surahHifdhStudentSchedule.findMany({
      where: {
        studentId,
        surahId: { in: uniqueSurahIds },
        status: HifdhScheduleStatus.COMPLETED,
        fromAyah: { not: null },
        toAyah: { not: null },
      },
    });

    for (const schedule of candidates) {
      if (schedule.fromAyah === null || schedule.toAyah === null) continue;
      const coveringEntries = await tx.studentSurahProgressEntry.findMany({
        where: {
          studentId,
          surahId: schedule.surahId,
          type: ProgressEntryType.NEW_LESSON,
          fromAyah: { gte: schedule.fromAyah, lte: schedule.toAyah },
        },
        select: { status: true },
      });
      const stillFullyCovered =
        coveringEntries.length > 0 &&
        coveringEntries.every(
          (e) =>
            e.status === ProgressEntryStatus.COMPLETED ||
            e.status === ProgressEntryStatus.VERIFIED,
        );
      if (!stillFullyCovered) {
        await tx.surahHifdhStudentSchedule.update({
          where: { id: schedule.id },
          data: {
            status: HifdhScheduleStatus.PENDING,
            completedAt: null,
            completionDate: null,
          },
        });
      }
    }
  }

  async bulkMarkCompleted(
    branchId: string,
    userId: string,
    dto: BulkMarkCompletedDto,
    remarkFile?: Express.Multer.File,
    publicBaseUrl?: string,
  ) {
    const remarkFileUrl = remarkFile
      ? `${publicBaseUrl}/uploads/voice-notes/${remarkFile.filename}`
      : undefined;
    const fetchedEntries = await this.prisma.studentSurahProgressEntry.findMany({
      where: { id: { in: dto.ayah_ids }, branchId },
    });
    if (fetchedEntries.length === 0) {
      throw new NotFoundException({
        status: 'error',
        message: 'No valid ayah progress records found',
      });
    }
    // Prisma's `id: { in: [...] }` doesn't preserve the filter array's input
    // order — re-sort to match dto.ayah_ids (the caller's intended marking
    // sequence) so updatedAt, stamped as the loop below processes each row,
    // reflects true marking order instead of arbitrary DB return order. The
    // activity timeline orders by updatedAt, so an unordered bulk mark here
    // is exactly what produced New Lesson entries showing out of sequence.
    const entryById = new Map(fetchedEntries.map((e) => [e.id, e]));
    const entries = dto.ayah_ids
      .map((id) => entryById.get(id))
      .filter((e): e is (typeof fetchedEntries)[number] => e != null);

    const completedAt = dto.completed_at
      ? new Date(dto.completed_at)
      : new Date();
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const updatedCountByStudentId = new Map<string, number>();
    const touchedSurahsByStudent = new Map<string, Set<string>>();

    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        if (entry.status === 'NOT_STARTED' || entry.status === 'IN_PROGRESS') {
          await tx.studentSurahProgressEntry.update({
            where: { id: entry.id },
            data: {
              status: 'COMPLETED',
              completedAt,
              grade: dto.grade ? GRADE_TO_ENUM[dto.grade] : undefined,
              remarks: dto.remarks,
              ...(remarkFileUrl && { remarkFile: remarkFileUrl }),
              lastUpdatedById: userId,
            },
          });
          updatedCount += 1;
          updatedCountByStudentId.set(
            entry.studentId,
            (updatedCountByStudentId.get(entry.studentId) ?? 0) + 1,
          );
          if (entry.surahId) {
            const surahIds =
              touchedSurahsByStudent.get(entry.studentId) ?? new Set<string>();
            surahIds.add(entry.surahId);
            touchedSurahsByStudent.set(entry.studentId, surahIds);
          }
        } else {
          skippedCount += 1;
          errors.push(
            `Ayah ${entry.fromAyah} is already ${STATUS_TO_LEGACY[entry.status]}`,
          );
        }
      }
      for (const [studentId, surahIds] of touchedSurahsByStudent) {
        await this.syncScheduleEntries(tx, studentId, [...surahIds]);
      }
    });

    await this.notifyProgressMarked(branchId, updatedCountByStudentId);

    let message = `${updatedCount} ayah(s) marked as completed successfully`;
    if (skippedCount > 0) {
      message += `. ${skippedCount} ayah(s) were skipped as they were already completed`;
    }

    return {
      status: 'success',
      message,
      data: {
        updated_count: updatedCount,
        skipped_count: skippedCount,
        total_processed: dto.ayah_ids.length,
        file_uploaded: Boolean(remarkFile),
        file_name: remarkFileUrl ?? null,
        errors,
      },
    };
  }

  // ── getPendingSurahList ──────────────────────────────────────────────
  async getPendingSurahList(
    branchId: string,
    studentId: string,
    type?: string,
  ) {
    const student = await this.requireActiveStudent(branchId, studentId);

    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: {
        studentId,
        fromAyah: 1,
        status: { notIn: ['COMPLETED', 'VERIFIED'] },
        ...this.typeWhere(type),
      },
      include: { surah: { select: SURAH_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    // Re-sort by pacing-plan order (see getScheduleOrderedSurahIds) rather
    // than the createdAt order the query above returned.
    const fallbackSurahIds: string[] = [];
    for (const e of entries) {
      if (e.surahId && !fallbackSurahIds.includes(e.surahId))
        fallbackSurahIds.push(e.surahId);
    }
    const orderedSurahIds = await this.getScheduleOrderedSurahIds(
      studentId,
      fallbackSurahIds,
    );
    const rank = new Map(orderedSurahIds.map((id, i) => [id, i]));
    const sortedEntries = [...entries].sort(
      (a, b) =>
        (rank.get(a.surahId ?? '') ?? Infinity) -
        (rank.get(b.surahId ?? '') ?? Infinity),
    );

    const surahs = sortedEntries
      .filter((e) => e.surah)
      .map((e) => ({
        surah: serializeSurah(e.surah!),
        status: STATUS_TO_LEGACY[e.status],
        type: e.type ? TYPE_TO_LEGACY[e.type] : null,
      }));

    return {
      status: 'success',
      data: {
        student: await this.formatStudentWithHalqa(student),
        pending_surahs: surahs,
        statistics: { total_pending_surahs: surahs.length },
        filter_applied: { type: type ?? null },
      },
    };
  }

  // ── bulkMarkSurahsAsCompleted ────────────────────────────────────────
  async bulkMarkSurahsAsCompleted(
    branchId: string,
    userId: string,
    dto: BulkMarkSurahsCompletedDto,
  ) {
    await this.requireActiveStudent(branchId, dto.student_id);

    const surahs = await this.prisma.surah.findMany({
      where: { id: { in: dto.surah_ids } },
    });
    const surahById = new Map(surahs.map((s) => [s.id, s]));

    const pending = await this.prisma.studentSurahProgressEntry.findMany({
      where: {
        studentId: dto.student_id,
        surahId: { in: dto.surah_ids },
        status: { notIn: ['COMPLETED', 'VERIFIED'] },
        ...(dto.type && { type: TYPE_TO_ENUM[dto.type] }),
      },
      // Explicit order so the loop below stamps updatedAt (which the
      // activity timeline sorts by) in true pacing-plan sequence instead of
      // Postgres's arbitrary unordered-query return order — without this,
      // a bulk mark can make New Lesson entries show out of sequence while
      // Old/Juzh (always marked one at a time) are unaffected.
      orderBy: { day: 'asc' },
    });
    if (pending.length === 0) {
      throw new NotFoundException({
        status: 'error',
        message: 'No pending progress entries found for the specified surahs',
      });
    }

    const completedAt = dto.completed_at
      ? new Date(dto.completed_at)
      : new Date();
    const entriesBySurah = new Map<string, number>();

    await this.prisma.$transaction(async (tx) => {
      for (const entry of pending) {
        await tx.studentSurahProgressEntry.update({
          where: { id: entry.id },
          data: {
            status: 'COMPLETED',
            completedAt,
            grade: dto.grade ? GRADE_TO_ENUM[dto.grade] : undefined,
            remarks: dto.remarks,
            lastUpdatedById: userId,
            // dto.type was only used above to select which pending rows to
            // touch — write it here too, or the entry keeps whatever type it
            // was originally seeded with (always NEW_LESSON today) instead
            // of the lesson type the caller actually marked it as.
            ...(dto.type && { type: TYPE_TO_ENUM[dto.type] }),
          },
        });
        if (entry.surahId)
          entriesBySurah.set(
            entry.surahId,
            (entriesBySurah.get(entry.surahId) ?? 0) + 1,
          );
      }
      await this.syncScheduleEntries(tx, dto.student_id, dto.surah_ids);
    });

    await this.notifyProgressMarked(
      branchId,
      new Map([[dto.student_id, pending.length]]),
    );

    const surahSummary = dto.surah_ids
      .map((surahId) => {
        const surah = surahById.get(surahId);
        if (!surah) return null;
        return {
          surah_id: surah.id,
          surah_name: surah.nameEnglish,
          completed_entries: entriesBySurah.get(surahId) ?? 0,
        };
      })
      .filter(Boolean);

    return {
      status: 'success',
      message: 'Bulk surah completion successful',
      data: {
        student_id: dto.student_id,
        total_surahs_processed: dto.surah_ids.length,
        total_entries_completed: pending.length,
        surah_summary: surahSummary,
        completed_at: formatDateOnly(completedAt),
        file_uploaded: false,
        file_name: null,
      },
    };
  }

  // ── getCompletedSurahList ────────────────────────────────────────────
  async getCompletedSurahList(
    branchId: string,
    studentId: string,
    type = 'New Lesson',
  ) {
    const student = await this.requireActiveStudent(branchId, studentId);

    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: {
        studentId,
        status: { not: 'NOT_STARTED' },
        ...this.typeWhere(type),
      },
      include: { surah: { select: SURAH_SELECT } },
    });

    const bySurah = new Map<
      string,
      {
        surah: NonNullable<(typeof entries)[number]['surah']>;
        total: number;
        completed: number;
        latestCompletedAt: Date | null;
      }
    >();
    for (const e of entries) {
      if (!e.surah) continue;
      const data = bySurah.get(e.surahId!) ?? {
        surah: e.surah,
        total: 0,
        completed: 0,
        latestCompletedAt: null,
      };
      data.total += 1;
      if (e.status === 'COMPLETED' || e.status === 'VERIFIED') {
        data.completed += 1;
        if (
          e.completedAt &&
          (!data.latestCompletedAt || e.completedAt > data.latestCompletedAt)
        ) {
          data.latestCompletedAt = e.completedAt;
        }
      }
      bySurah.set(e.surahId!, data);
    }

    let totalCompletedOverall = 0;
    let totalOverall = 0;
    const completedSurahs = [...bySurah.values()].map((data) => {
      totalCompletedOverall += data.completed;
      totalOverall += data.total;
      const status =
        data.completed === data.total &&
        data.total > 0 &&
        data.total === data.surah.totalAyahs
          ? 'completed'
          : 'partially completed';
      return {
        surah_id: data.surah.id,
        surah_number: data.surah.number,
        surah_name_ar: data.surah.nameArabic,
        surah_name_en: data.surah.nameEnglish,
        total_ayahs_in_surah: data.surah.totalAyahs,
        completed_ayah_count: data.completed,
        surah_completed_at: formatDateTime(data.latestCompletedAt),
        surah_completed_at_date: formatDateOnly(data.latestCompletedAt),
        status,
        total_entries: data.total,
        completed_entries: data.completed,
        progress_percentage:
          data.total > 0
            ? Math.round((data.completed / data.total) * 10000) / 100
            : 0,
      };
    });
    completedSurahs.sort((a, b) => b.surah_number - a.surah_number);

    return {
      status: 'success',
      data: {
        student: await this.formatStudentWithHalqa(student),
        surahs: completedSurahs,
        statistics: {
          total_surahs_with_progress: completedSurahs.length,
          fully_completed_surahs: completedSurahs.filter(
            (s) => s.status === 'completed',
          ).length,
          partially_completed_surahs: completedSurahs.filter(
            (s) => s.status === 'partially completed',
          ).length,
          total_ayahs_completed_overall: totalCompletedOverall,
          total_ayahs_covered_overall: totalOverall,
        },
        filter_applied: { type },
      },
    };
  }

  // ── storeOldLessonProgress ───────────────────────────────────────────
  async storeOldLessonProgress(
    branchId: string,
    userId: string,
    dto: StoreOldLessonProgressDto,
    remarkFile?: Express.Multer.File,
    publicBaseUrl?: string,
  ) {
    const remarkFileUrl = remarkFile
      ? `${publicBaseUrl}/uploads/voice-notes/${remarkFile.filename}`
      : undefined;
    await this.requireActiveStudent(branchId, dto.student_id);

    let surahId: string | undefined;
    let fromAyah: number | undefined;
    let toAyah: number | undefined;

    if (dto.surah_from) {
      const surahFrom = await this.prisma.surah.findUnique({
        where: { number: dto.surah_from },
      });
      if (surahFrom) {
        surahId = surahFrom.id;
        fromAyah = dto.surah_from_ayah ?? 1;
      }
    }
    if (dto.surah_to) {
      const surahTo = await this.prisma.surah.findUnique({
        where: { number: dto.surah_to },
      });
      if (surahTo) {
        surahId = surahId ?? surahTo.id;
        toAyah = dto.surah_to_ayah ?? surahTo.totalAyahs;
      }
    }

    const entry = await this.prisma.studentSurahProgressEntry.create({
      data: {
        branchId,
        studentId: dto.student_id,
        type: TYPE_TO_ENUM[dto.type],
        status: 'COMPLETED',
        completedAt: new Date(dto.completed_at),
        grade: dto.grade ? GRADE_TO_ENUM[dto.grade] : undefined,
        remarks: dto.remarks,
        ...(remarkFileUrl && { remarkFile: remarkFileUrl }),
        surahId,
        fromAyah,
        toAyah,
        surahFrom: dto.surah_from,
        surahFromAyah: dto.surah_from_ayah,
        surahTo: dto.surah_to,
        surahToAyah: dto.surah_to_ayah,
        juzuhFrom: dto.juzuh_from,
        juzuhTo: dto.juzuh_to,
        pageFrom: dto.page_from,
        pageTo: dto.page_to,
        pageCount: dto.page_count,
        addedById: userId,
        lastUpdatedById: userId,
      },
    });

    return {
      status: 'success',
      message: 'Old Lesson progress saved successfully',
      data: {
        id: entry.id,
        student_id: entry.studentId,
        type: TYPE_TO_LEGACY[entry.type!],
        completion_status: STATUS_TO_LEGACY[entry.status],
        completed_at: formatDateOnly(entry.completedAt),
        grade: entry.grade ? GRADE_TO_LEGACY[entry.grade] : null,
        remarks: entry.remarks,
        remark_file_url: entry.remarkFile ?? null,
        surah_from: entry.surahFrom,
        surah_from_ayah: entry.surahFromAyah,
        surah_to: entry.surahTo,
        surah_to_ayah: entry.surahToAyah,
        juzuh_from: entry.juzuhFrom,
        juzuh_to: entry.juzuhTo,
        page_from: entry.pageFrom,
        page_to: entry.pageTo,
        page_count: entry.pageCount,
        surah_range: entry.surahFrom
          ? `${entry.surahFrom}${entry.surahTo && entry.surahTo !== entry.surahFrom ? `-${entry.surahTo}` : ''}`
          : null,
        juzuh_range: entry.juzuhFrom
          ? `${entry.juzuhFrom}${entry.juzuhTo && entry.juzuhTo !== entry.juzuhFrom ? `-${entry.juzuhTo}` : ''}`
          : null,
        page_range: entry.pageFrom
          ? `${entry.pageFrom}${entry.pageTo && entry.pageTo !== entry.pageFrom ? `-${entry.pageTo}` : ''}`
          : entry.pageCount
            ? `${entry.pageCount} pages`
            : null,
        created_at: formatDateTime(entry.createdAt),
      },
    };
  }

  // ── getOldLessonProgressList ─────────────────────────────────────────
  async getOldLessonProgressList(
    branchId: string,
    studentId: string,
    query: GetOldLessonProgressQueryDto,
  ) {
    const student = await this.requireActiveStudent(branchId, studentId);

    const where: Prisma.StudentSurahProgressEntryWhereInput = {
      studentId,
      type: TYPE_TO_ENUM[query.type],
    };
    if (query.completed_at_from || query.completed_at_to) {
      where.completedAt = {
        ...(query.completed_at_from && {
          gte: new Date(`${query.completed_at_from}T00:00:00.000Z`),
        }),
        ...(query.completed_at_to && {
          lte: new Date(`${query.completed_at_to}T23:59:59.999Z`),
        }),
      };
    }
    if (query.surah_from) where.surahFrom = { gte: Number(query.surah_from) };
    if (query.surah_to) where.surahTo = { lte: Number(query.surah_to) };
    if (query.juzuh_from) where.juzuhFrom = { gte: Number(query.juzuh_from) };
    if (query.juzuh_to) where.juzuhTo = { lte: Number(query.juzuh_to) };
    if (query.page_from) where.pageFrom = { gte: Number(query.page_from) };
    if (query.page_to) where.pageTo = { lte: Number(query.page_to) };
    if (query.grade) where.grade = GRADE_TO_ENUM[query.grade];

    const [total, completedCount, verifiedCount] = await Promise.all([
      this.prisma.studentSurahProgressEntry.count({ where }),
      this.prisma.studentSurahProgressEntry.count({
        where: { ...where, status: 'COMPLETED' },
      }),
      this.prisma.studentSurahProgressEntry.count({
        where: { ...where, status: 'VERIFIED' },
      }),
    ]);

    const perPage = query.per_page ? Number(query.per_page) : 15;
    const page = 1;
    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where,
      include: ENTRY_INCLUDE,
      // completedAt is date-only, so same-day entries (e.g. several Juzh
      // marks today) all tie and sort arbitrarily — updatedAt is the only
      // field that reliably reflects true marking order (see the identical
      // fix on current_cycle_types / buildActivityTimeline).
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Old/Juzh Lesson entries store surahFrom/surahTo as bare surah numbers
    // (not relations) — batch-resolve both ends' names so the mobile app can
    // show "Al-Ikhlas -> An-Nas" instead of "Surah 112 -> Surah 114".
    const surahNumbers = [
      ...new Set(
        entries.flatMap((e) =>
          [e.surahFrom, e.surahTo].filter((n): n is number => n != null),
        ),
      ),
    ];
    const surahByNumber = new Map<
      number,
      { nameEnglish: string; nameArabic: string }
    >();
    if (surahNumbers.length > 0) {
      const surahs = await this.prisma.surah.findMany({
        where: { number: { in: surahNumbers } },
        select: { number: true, nameEnglish: true, nameArabic: true },
      });
      for (const s of surahs) surahByNumber.set(s.number, s);
    }

    // Old/Juzh Lesson entries recorded via the "Surah" method only ever get
    // surahId/fromAyah/toAyah set (no juzuhFrom/To or pageFrom/To/pageCount)
    // — without this, they're invisible to any page/Juz' total that sums
    // those fields, even though the student genuinely covered real pages.
    // Reuses the exact same real-content-line lookup as New Lesson's page
    // count (countPageCompletion), so "a page" means the same thing here
    // as it does everywhere else in this report.
    const derivableEntries = entries.filter(
      (e) => e.surahId != null && e.fromAyah != null && e.toAyah != null,
    );
    const { pages: derivedPagesByEntry } = derivableEntries.length
      ? await this.countPageCompletion(
          derivableEntries.map((e) => ({
            groupKey: e.id,
            surahId: e.surahId!,
            fromAyah: e.fromAyah!,
            toAyah: e.toAyah!,
          })),
        )
      : { pages: new Map<string, number>() };

    const progressData = entries.map((entry) => ({
      ...serializeEntry(entry),
      surah_derived_page_count: derivedPagesByEntry.get(entry.id) ?? 0,
      surah_from: entry.surahFrom,
      surah_from_ayah: entry.surahFromAyah,
      surah_from_name_en:
        entry.surahFrom != null
          ? (surahByNumber.get(entry.surahFrom)?.nameEnglish ?? null)
          : null,
      surah_from_name_ar:
        entry.surahFrom != null
          ? (surahByNumber.get(entry.surahFrom)?.nameArabic ?? null)
          : null,
      surah_to: entry.surahTo,
      surah_to_ayah: entry.surahToAyah,
      surah_to_name_en:
        entry.surahTo != null
          ? (surahByNumber.get(entry.surahTo)?.nameEnglish ?? null)
          : null,
      surah_to_name_ar:
        entry.surahTo != null
          ? (surahByNumber.get(entry.surahTo)?.nameArabic ?? null)
          : null,
      surah_range: entry.surahFrom
        ? `${entry.surahFrom}${entry.surahTo && entry.surahTo !== entry.surahFrom ? `-${entry.surahTo}` : ''}`
        : null,
      juzuh_from: entry.juzuhFrom,
      juzuh_to: entry.juzuhTo,
      juzuh_range: entry.juzuhFrom
        ? `${entry.juzuhFrom}${entry.juzuhTo && entry.juzuhTo !== entry.juzuhFrom ? `-${entry.juzuhTo}` : ''}`
        : null,
      page_from: entry.pageFrom,
      page_to: entry.pageTo,
      page_count: entry.pageCount,
      page_range: entry.pageFrom
        ? `${entry.pageFrom}${entry.pageTo && entry.pageTo !== entry.pageFrom ? `-${entry.pageTo}` : ''}`
        : entry.pageCount
          ? `${entry.pageCount} pages`
          : null,
    }));

    const lastPage = Math.max(1, Math.ceil(total / perPage));

    return {
      status: 'success',
      data: {
        student: await this.formatStudentWithHalqa(student),
        progress_records: progressData,
        pagination: {
          current_page: page,
          per_page: perPage,
          total,
          last_page: lastPage,
          from: total > 0 ? 1 : null,
          to: Math.min(perPage, total),
          has_more_pages: page < lastPage,
        },
        statistics: {
          total_records: total,
          completed_records: completedCount,
          verified_records: verifiedCount,
        },
        filters_applied: {
          type: query.type,
          completed_at_from: query.completed_at_from ?? null,
          completed_at_to: query.completed_at_to ?? null,
          surah_from: query.surah_from ?? null,
          surah_to: query.surah_to ?? null,
          juzuh_from: query.juzuh_from ?? null,
          juzuh_to: query.juzuh_to ?? null,
          page_from: query.page_from ?? null,
          page_to: query.page_to ?? null,
          grade: query.grade ?? null,
        },
      },
    };
  }

  private ayahSpan(fromAyah: number | null, toAyah: number | null): number {
    if (fromAyah === null || toAyah === null) return 0;
    return toAyah - fromAyah + 1;
  }

  /**
   * Real physical-page completion, grouped by caller-supplied key:
   * `pages` = count of physical Mushaf pages (of 604) where the student
   * has covered literally every real ayah-text line that page contains;
   * `lines` = sum of covered lines on the pages that are NOT yet fully
   * covered (so a complete page's lines never get double-counted into
   * `lines` too).
   *
   * Crucially, a page's "every real line" is NOT a flat 15 — most pages
   * carry 2-3 short Surahs together, and each Surah transition eats one
   * or more lines for its name/Bismillah header, so the real content total
   * on a given page is often 9-11 lines, never 15. Comparing a student's
   * coverage against a flat 15 both (a) called genuinely-finished pages
   * "incomplete" forever (no one can ever fill a header line with ayah
   * text) and (b) couldn't tell a true header gap apart from a real
   * not-yet-recited Surah sitting in the same gap — e.g. page 601 carries
   * Al-Asr + Al-Humazah + Al-Fil; a student who's done Al-Asr and Al-Fil
   * but not Al-Humazah has a 3-line gap that is REAL pending content, not
   * header space, and the flat-15 version couldn't distinguish that from
   * the page's own genuine ceiling of 9 real lines (the other 6 "missing"
   * lines are pure margin/header, unreachable by anyone, ever). Per-page
   * real-content totals are computed fresh each call (one groupBy over
   * the whole SurahAyahPageLine table — 6236 rows, cheap, and this data
   * only changes via the admin import), not hardcoded, since an import
   * correction should immediately take effect without a redeploy.
   */
  async countPageCompletion(
    entries: { groupKey: string; surahId: string; fromAyah: number; toAyah: number }[],
  ): Promise<{ pages: Map<string, number>; lines: Map<string, number> }> {
    const uniqueSurahIds = [...new Set(entries.map((e) => e.surahId))];
    const [pageLines, pageMaxLines] = await Promise.all([
      uniqueSurahIds.length
        ? this.prisma.surahAyahPageLine.findMany({
            where: { surahId: { in: uniqueSurahIds } },
            select: { surahId: true, ayahNumber: true, quranPageId: true, lineFrom: true, lineTo: true },
          })
        : Promise.resolve([]),
      this.prisma.surahAyahPageLine.groupBy({
        by: ['quranPageId'],
        _max: { lineTo: true },
      }),
    ]);
    const lineInfoOf = new Map<
      string,
      { quranPageId: string; lineFrom: number; lineTo: number }
    >();
    for (const pl of pageLines) {
      lineInfoOf.set(`${pl.surahId}:${pl.ayahNumber}`, {
        quranPageId: pl.quranPageId,
        lineFrom: pl.lineFrom,
        lineTo: pl.lineTo,
      });
    }
    // Real total content-line count per physical page, across EVERY surah
    // that lands on it (not just the ones in `entries`) — a page's true
    // ceiling, not a flat 15.
    const realMaxByPage = new Map(pageMaxLines.map((p) => [p.quranPageId, p._max.lineTo ?? 15]));

    const coveredByGroupPage = new Map<string, Map<string, Set<number>>>();
    for (const e of entries) {
      const pageMap = coveredByGroupPage.get(e.groupKey) ?? new Map<string, Set<number>>();
      for (let ayah = e.fromAyah; ayah <= e.toAyah; ayah++) {
        const info = lineInfoOf.get(`${e.surahId}:${ayah}`);
        if (!info) continue;
        const lines = pageMap.get(info.quranPageId) ?? new Set<number>();
        for (let l = info.lineFrom; l <= info.lineTo; l++) lines.add(l);
        pageMap.set(info.quranPageId, lines);
      }
      coveredByGroupPage.set(e.groupKey, pageMap);
    }

    const pagesByGroup = new Map<string, number>();
    const linesByGroup = new Map<string, number>();
    for (const [groupKey, pageMap] of coveredByGroupPage) {
      let completePages = 0;
      let partialLines = 0;
      for (const [pageId, lines] of pageMap) {
        const realMax = realMaxByPage.get(pageId) ?? 15;
        if (lines.size >= realMax) completePages++;
        else partialLines += lines.size;
      }
      pagesByGroup.set(groupKey, completePages);
      linesByGroup.set(groupKey, partialLines);
    }
    return { pages: pagesByGroup, lines: linesByGroup };
  }

  /** Public: by-student convenience wrapper, reused by StudentsService's activity-report (see buildActivityTimeline). */
  async countPageCompletionByStudent(
    entries: { studentId: string; surahId: string; fromAyah: number; toAyah: number }[],
  ): Promise<{ pages: Map<string, number>; lines: Map<string, number> }> {
    return this.countPageCompletion(entries.map((e) => ({ groupKey: e.studentId, ...e })));
  }

  /** Public: reused by other mobile-api services (e.g. exam report) that need the same teacher/halqa/student scoping. */
  async activeStudentsForReport(
    branchId: string,
    halqaId: string | undefined,
    studentId: string | undefined,
    userId: string,
  ) {
    const ownHalqaIds = await this.ownHalqaIdsIfTeacher(userId);
    // A Teacher caller is restricted to their own halqa(s) regardless of
    // what halqa_id they pass — an explicit id outside that set (or no
    // teacher-owned halqas at all) resolves to "no students", not "every
    // student in the branch".
    const effectiveHalqaIds =
      ownHalqaIds === null
        ? undefined
        : halqaId
          ? ownHalqaIds.filter((id) => id === halqaId)
          : ownHalqaIds;

    return this.prisma.student.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
        ...(effectiveHalqaIds !== undefined
          ? {
              halqaMemberships: {
                some: { halqaId: { in: effectiveHalqaIds }, removedAt: null },
              },
            }
          : halqaId && {
              halqaMemberships: { some: { halqaId, removedAt: null } },
            }),
        ...(studentId && { id: studentId }),
      },
      include: { user: { select: { email: true } } },
    });
  }

  // ── getTodayProgress ─────────────────────────────────────────────────
  async getTodayProgress(
    branchId: string,
    userId: string,
    query: GetTodayProgressQueryDto,
  ) {
    const fromDate = query.from_date ?? formatDateOnly(new Date())!;
    const toDate = query.to_date ?? fromDate;
    const range = {
      gte: new Date(`${fromDate}T00:00:00.000Z`),
      lte: new Date(`${toDate}T23:59:59.999Z`),
    };

    // A Student caller always gets their own record, regardless of what
    // student_id they pass — the mobile app's "My Today's Progress" widget
    // was sending the auth User id there instead of the Student id (two
    // different rows), which silently matched nothing. Resolving it
    // server-side fixes that and also stops a student from being able to
    // query another student's today-progress by passing an arbitrary id.
    const isStudentRole = await this.context.hasRole(userId, 'Student');
    const effectiveStudentId = isStudentRole
      ? await this.context.resolveOwnStudentId(userId)
      : query.student_id;

    const students = await this.activeStudentsForReport(
      branchId,
      query.halqa_id,
      effectiveStudentId,
      userId,
    );
    const studentIds = students.map((s) => s.id);

    const completedRecords =
      await this.prisma.studentSurahProgressEntry.findMany({
        where: {
          branchId,
          studentId: { in: studentIds },
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: range,
          ...(query.type && { type: TYPE_TO_ENUM[query.type] }),
        },
        include: { surah: { select: SURAH_SELECT } },
      });

    const progressByStudent = new Map<string, typeof completedRecords>();
    for (const r of completedRecords) {
      const list = progressByStudent.get(r.studentId) ?? [];
      list.push(r);
      progressByStudent.set(r.studentId, list);
    }

    // Current New -> Juzh -> Old cycle position per student, persisting
    // across days (NOT reset by "today" — a student's cycle position is
    // whatever they last marked, whenever that was). All-time, lightweight
    // query (3 scalar columns, no joins) so this stays cheap even for a
    // student enrolled for years. Only the entries from the most recent
    // "New Lesson" onward represent the CURRENT cycle — anything before
    // that New Lesson belongs to a prior cycle.
    //
    // Ordered by updatedAt, not createdAt or completedAt: New Lesson rows
    // are often pre-created in bulk when a student's Hifdh schedule is
    // generated (stale createdAt, unrelated to marking time), and
    // completedAt is a date-only field the teacher picks (or the schedule
    // pre-sets), so several types can share the exact same completedAt day
    // with no way to tell which was marked first. Prisma's @updatedAt is
    // the one field that's always refreshed at the actual moment a row's
    // status transitions to COMPLETED/VERIFIED, regardless of when the row
    // was first created — verified against production data where a
    // student's Juzh/Old/New were all completedAt-today but updatedAt
    // showed the true marking order.
    const allTimeLessonEntries =
      await this.prisma.studentSurahProgressEntry.findMany({
        where: {
          branchId,
          studentId: { in: studentIds },
          status: { in: ['COMPLETED', 'VERIFIED'] },
          type: { in: ['NEW_LESSON', 'JUZH_LESSON', 'OLD_LESSON'] },
        },
        select: {
          studentId: true,
          type: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'asc' },
      });
    const lessonHistoryByStudent = new Map<
      string,
      { type: string; updatedAt: Date }[]
    >();
    for (const e of allTimeLessonEntries) {
      if (!e.type) continue;
      const list = lessonHistoryByStudent.get(e.studentId) ?? [];
      list.push({ type: e.type, updatedAt: e.updatedAt });
      lessonHistoryByStudent.set(e.studentId, list);
    }
    const currentCycleTypesByStudent = new Map<string, string[]>();
    // Last moment this student actually had a lesson marked, all-time —
    // used for the "Not Recited N days ago" tag. Since allTimeLessonEntries
    // is ordered by updatedAt ascending, each student's last history entry
    // is already their latest mark.
    const lastRecitedDateByStudent = new Map<string, Date>();
    for (const [studentId, history] of lessonHistoryByStudent) {
      const lastNewIndex = history.map((h) => h.type).lastIndexOf('NEW_LESSON');
      const cycleSlice = lastNewIndex >= 0 ? history.slice(lastNewIndex) : history;
      const distinctTypes: string[] = [];
      for (const h of cycleSlice) {
        const label = TYPE_TO_LEGACY[h.type as ProgressEntryType];
        if (!distinctTypes.includes(label)) distinctTypes.push(label);
      }
      currentCycleTypesByStudent.set(studentId, distinctTypes);
      const last = history[history.length - 1];
      if (last) lastRecitedDateByStudent.set(studentId, last.updatedAt);
    }
    const earliestLastRecitedDate =
      lastRecitedDateByStudent.size > 0
        ? new Date(
            Math.min(
              ...[...lastRecitedDateByStudent.values()].map((d) =>
                d.getTime(),
              ),
            ),
          )
        : null;

    const [leaves, exams, holidays, recitationGapHolidays] = await Promise.all([
      this.prisma.studentLeave.findMany({
        where: {
          studentId: { in: studentIds },
          status: 'APPROVED',
          leaveDate: { gte: new Date(fromDate), lte: new Date(toDate) },
        },
      }),
      this.prisma.studentExam.findMany({
        where: {
          studentId: { in: studentIds },
          examDate: { gte: new Date(fromDate), lte: new Date(toDate) },
        },
      }),
      this.prisma.calendarDay.findMany({
        where: {
          branchId,
          isHoliday: true,
          date: { gte: new Date(fromDate), lte: new Date(toDate) },
        },
        orderBy: { date: 'asc' },
      }),
      earliestLastRecitedDate
        ? this.prisma.calendarDay.findMany({
            where: {
              branchId,
              isWorkingDay: false,
              date: { gt: earliestLastRecitedDate, lte: new Date(toDate) },
            },
            select: { date: true },
          })
        : Promise.resolve([] as { date: Date }[]),
    ]);
    // Non-working days (holidays + weekly-offs) between the earliest
    // "last recited" date found and the viewed date — used to make the
    // "Not Recited N days ago" count school-days-only.
    const recitationNonWorkingSet = new Set(
      recitationGapHolidays.map((h) => formatDateOnly(h.date)),
    );
    const leavesByStudent = new Map<string, typeof leaves>();
    for (const l of leaves)
      leavesByStudent.set(l.studentId, [
        ...(leavesByStudent.get(l.studentId) ?? []),
        l,
      ]);
    const examsByStudent = new Map<string, typeof exams>();
    for (const e of exams)
      examsByStudent.set(e.studentId, [
        ...(examsByStudent.get(e.studentId) ?? []),
        e,
      ]);

    const completedStudents: Record<string, unknown>[] = [];
    const pendingStudents: Record<string, unknown>[] = [];
    // Students on leave today with no progress recorded — previously just
    // silently dropped from both buckets. Kept separate so a consumer like
    // the Halqa students list can show a "Leave" status tag for them
    // instead of them vanishing from the day entirely.
    const onLeaveStudents: Record<string, unknown>[] = [];
    // A student who's marked some but not all of today's required types
    // under the unfiltered "All" view is intentionally kept out of the
    // three buckets above (see the comment further down) — correct for
    // the Today's Progress tabbed screens, which already show them under
    // their specific New/Juzh/Old tab. But a consumer with no tabs at all
    // (the Halqa students list) has nowhere else to find them, so they'd
    // otherwise vanish from the response entirely and show no status tag.
    // Kept here so any such consumer can still look them up.
    const partialStudents: Record<string, unknown>[] = [];

    for (const student of students) {
      const records = progressByStudent.get(student.id);
      const activities: Record<string, unknown>[] = [];
      const lessonTypesMap = new Map<
        string,
        { type: string; total_ayahs: number; entries_count: number }
      >();
      const surahsCompleted: Record<string, unknown>[] = [];
      let totalAyahsToday = 0;

      if (records) {
        for (const r of records) {
          const ayahs = this.ayahSpan(r.fromAyah, r.toAyah);
          totalAyahsToday += ayahs;
          const typeLabel = r.type ? TYPE_TO_LEGACY[r.type] : 'Lesson';
          activities.push({
            type: typeLabel,
            description: `Completed ${typeLabel} – Surah ${r.surah?.nameEnglish ?? ''} (verses ${r.fromAyah}-${r.toAyah})`,
            time: r.completedAt ? r.completedAt.toISOString() : null,
            details: {
              surah_id: r.surahId,
              from_ayah: r.fromAyah,
              to_ayah: r.toAyah,
              grade: r.grade ? GRADE_TO_LEGACY[r.grade] : null,
              remark_file_url: r.remarkFile ?? null,
            },
          });
          const key = typeLabel;
          const entry = lessonTypesMap.get(key) ?? {
            type: typeLabel,
            total_ayahs: 0,
            entries_count: 0,
          };
          entry.total_ayahs += ayahs;
          entry.entries_count += 1;
          lessonTypesMap.set(key, entry);
          if (
            r.surah &&
            !surahsCompleted.some(
              (s) => (s as { id: string }).id === r.surah!.id,
            )
          ) {
            // One recording covers every ayah marked in the same batch, so
            // the first entry with a remark file for this surah today
            // represents that recording for the whole card — no need to
            // carry (or repeat) it per ayah at this summary-card level.
            surahsCompleted.push({
              ...serializeSurahBasic(r.surah),
              remark_file_url: r.remarkFile ?? null,
            });
          }
        }
      }

      for (const leave of leavesByStudent.get(student.id) ?? []) {
        activities.push({
          type: 'leave',
          description: `Approved leave${leave.reason ? ` – ${leave.reason}` : ''}`,
          time: leave.createdAt.toISOString(),
          details: { leave_id: leave.id },
        });
      }
      for (const exam of examsByStudent.get(student.id) ?? []) {
        activities.push({
          type: 'exam',
          description: `Exam: ${exam.examId ?? 'General'}`,
          time: exam.examDate.toISOString(),
          details: { exam_id: exam.id, score: exam.marks ?? null },
        });
      }
      activities.sort((a, b) =>
        String(a.time ?? '').localeCompare(String(b.time ?? '')),
      );

      // A student who's on approved leave or already has an exam/Mukammal
      // marked today is "handled" for the day even without ordinary lesson
      // progress — don't let them clutter the Pending bucket.
      const hasLeaveToday = (leavesByStudent.get(student.id) ?? []).length > 0;
      const hasExamToday = (examsByStudent.get(student.id) ?? []).length > 0;

      // Most recent exam/Mukammal today, for the student card's evaluation
      // chip — mode/result/marks so the card can show e.g. "Mukammal · Pass
      // (85)" instead of just a generic "Exam" marker.
      const todaysExams = examsByStudent.get(student.id) ?? [];
      const latestExam = todaysExams.length > 0 ? todaysExams[todaysExams.length - 1] : null;
      const evaluation = latestExam
        ? {
            kind: latestExam.examMode === 'MUKAMMAL' ? 'Mukammal' : 'Exam',
            result: latestExam.result ?? null,
            marks: latestExam.marks != null ? Number(latestExam.marks) : null,
          }
        : null;

      // Surfaced separately from the activities feed so the card doesn't
      // need to parse that generic array just to show a remarks indicator.
      const remarkTexts = [
        ...(records ?? []).map((r) => r.remarks).filter((r): r is string => !!r),
        ...(latestExam?.remarks ? [latestExam.remarks] : []),
      ];

      // School-days-only gap since this student's last recorded mark of any
      // kind — powers the "Not Recited N days ago" tag. null when they've
      // never recited (mirrors days_since_last_exam's "never evaluated").
      const lastRecitedDate = lastRecitedDateByStudent.get(student.id) ?? null;
      const daysSinceLastRecited = lastRecitedDate
        ? countSchoolDaysSince(
            lastRecitedDate,
            new Date(`${toDate}T00:00:00.000Z`),
            recitationNonWorkingSet,
          )
        : null;

      const studentData: Record<string, unknown> = {
        student: await this.formatStudentBasic(student),
        activities,
        total_ayahs_today: totalAyahsToday,
        lesson_types: [...lessonTypesMap.values()],
        surahs_completed: surahsCompleted,
        is_on_leave: hasLeaveToday,
        // Persists across days — see currentCycleTypesByStudent above.
        current_cycle_types: currentCycleTypesByStudent.get(student.id) ?? [],
        days_since_last_recited: daysSinceLastRecited,
        evaluation,
        remarks: remarkTexts.length > 0 ? remarkTexts.join('; ') : null,
      };

      // On a single-type tab (New/Juzh/Old — query.type set), "Completed"
      // just means that one type was marked today — the query itself is
      // already scoped to that type, so todaysTypes can only ever contain
      // it; checking it against the student's full current cycle (which
      // can span more than one type, e.g. New marked earlier today then
      // Juzh after) would almost always fail, since a type-filtered view
      // can never see marks of a *different* type regardless of whether
      // they also happened today.
      //
      // On the unfiltered "All" view (query.type unset), "Completed"
      // requires literally all three lesson types marked today — see the
      // commit that introduced this for the reasoning (current_cycle_types
      // alone under-counts "done" there).
      const todaysTypes = new Set(lessonTypesMap.keys());
      const hasAllCycleTypesToday = query.type
        ? todaysTypes.has(query.type)
        : Object.values(TYPE_TO_LEGACY).every((t) => todaysTypes.has(t));

      if (
        (records && records.length > 0 && hasAllCycleTypesToday) ||
        // An exam/Mukammal today "handles" the student for the day even
        // without ordinary lesson progress — but only on the unfiltered
        // "All" view. On a New/Juzh/Old tab, "Completed" specifically means
        // that type was marked today; a student who only took an exam
        // didn't mark that type, so they still need a bucket (or they'd
        // silently vanish) but it isn't this one.
        (!query.type && hasExamToday)
      ) {
        completedStudents.push(studentData);
      } else if (hasLeaveToday) {
        onLeaveStudents.push(studentData);
      } else if (query.type || todaysTypes.size === 0) {
        // Under "All" (no type filter), Pending means genuinely hasn't
        // started — not "hasn't finished everything." A student who's
        // marked some but not all of today's required types is already
        // correctly shown under whichever specific New/Juzh/Old tab
        // applies to what they did; listing them in "All" Pending too
        // would make Pending mean "not entirely done" instead of
        // "nothing done," and double-count them against those tabs.
        pendingStudents.push(studentData);
      } else {
        // A partial-completion student under "All" — intentionally not
        // placed in any of the three buckets above (see comment above),
        // but still recorded in partialStudents so a tabless consumer can
        // find them (see partialStudents' own comment).
        partialStudents.push(studentData);
      }
    }

    const globalEvents = holidays.map((h) => ({
      type: 'holiday',
      description: `Holiday: ${h.holidayName ?? 'Holiday'}`,
      date: formatDateOnly(h.date),
      details: { holiday_id: h.id },
    }));

    return {
      status: 'success',
      data: {
        date_range: { from_date: fromDate, to_date: toDate },
        filters: {
          from_date: fromDate,
          to_date: toDate,
          halqa_id: query.halqa_id ?? null,
          student_id: query.student_id ?? null,
          type: query.type ?? null,
        },
        completed: {
          total_students: completedStudents.length,
          students: completedStudents,
        },
        pending: {
          total_students: pendingStudents.length,
          students: pendingStudents,
        },
        on_leave: {
          total_students: onLeaveStudents.length,
          students: onLeaveStudents,
        },
        partial: {
          total_students: partialStudents.length,
          students: partialStudents,
        },
        global_events: globalEvents,
      },
    };
  }

  /**
   * Batched target/actual-ayahs lookup for a whole student set — used by
   * getStudentsExceededTarget/studentsWithPendingTargets, which used to
   * call a single-student version in a sequential per-student loop (2N
   * DB round-trips for N students). For "all halqas" with many students
   * that was the same class of problem that made Top Students slow/502:
   * two groupBy aggregations (one for schedules, one for progress entries)
   * replace 2N findMany calls with 2 total, using the same
   * sum(to) - sum(from) + count === sum(to - from + 1) decomposition as
   * getTopStudents (non-null from/to filtered in, since a null-range row
   * contributes 0 either way).
   */
  // No `type` parameter — the Hifdh schedule (the "target" side) only ever
  // represents the New Lesson memorization pacing plan, there's no Old/Juzh
  // Lesson schedule concept at all. Filtering "actual" to Old/Juzh while
  // "target" stayed unfiltered used to produce a meaningless comparison
  // (every student looked artificially behind, since actual was scoped to
  // a lesson type target never covers). Always scoping both sides to New
  // Lesson is the only comparison that's ever coherent here.
  private async targetAndActualAyahsBatch(
    branchId: string,
    studentIds: string[],
    fromDate: string,
    toDate: string,
  ): Promise<Map<string, { targetAyahs: number; actualAyahs: number }>> {
    const result = new Map<
      string,
      { targetAyahs: number; actualAyahs: number }
    >();
    if (studentIds.length === 0) return result;
    for (const id of studentIds) result.set(id, { targetAyahs: 0, actualAyahs: 0 });

    const [scheduleGroups, progressGroups] = await Promise.all([
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          scheduledDate: { gte: new Date(fromDate), lte: new Date(toDate) },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        _sum: { fromAyah: true, toAyah: true },
        _count: { _all: true },
      }),
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId'],
        where: {
          branchId,
          studentId: { in: studentIds },
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: {
            gte: new Date(`${fromDate}T00:00:00.000Z`),
            lte: new Date(`${toDate}T23:59:59.999Z`),
          },
          type: TYPE_TO_ENUM['New Lesson'],
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        _sum: { fromAyah: true, toAyah: true },
        _count: { _all: true },
      }),
    ]);

    for (const g of scheduleGroups) {
      const entry = result.get(g.studentId);
      if (entry) {
        entry.targetAyahs =
          (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0) + g._count._all;
      }
    }
    for (const g of progressGroups) {
      const entry = result.get(g.studentId);
      if (entry) {
        entry.actualAyahs =
          (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0) + g._count._all;
      }
    }
    return result;
  }

  /**
   * Real page/line completion version of targetAndActualAyahsBatch — raw
   * ayah count isn't a reliable stand-in for "how much Quran" (see
   * getTopStudents' ranking fix for why), so the Pending/Exceeded Target
   * worklists show this instead of ayahs. Pulls per-row (surahId,
   * fromAyah, toAyah) tuples — not an aggregate — because
   * countPageCompletion needs the real per-ayah page/line lookup, not
   * just a sum.
   */
  private async targetAndActualPagesBatch(
    branchId: string,
    studentIds: string[],
    fromDate: string,
    toDate: string,
  ): Promise<
    Map<string, { targetPages: number; targetLines: number; actualPages: number; actualLines: number }>
  > {
    const result = new Map<
      string,
      { targetPages: number; targetLines: number; actualPages: number; actualLines: number }
    >();
    if (studentIds.length === 0) return result;
    for (const id of studentIds) {
      result.set(id, { targetPages: 0, targetLines: 0, actualPages: 0, actualLines: 0 });
    }

    const [scheduleRows, progressRows] = await Promise.all([
      this.prisma.surahHifdhStudentSchedule.findMany({
        where: {
          studentId: { in: studentIds },
          scheduledDate: { gte: new Date(fromDate), lte: new Date(toDate) },
          surahId: { not: null },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        select: { studentId: true, surahId: true, fromAyah: true, toAyah: true },
      }),
      this.prisma.studentSurahProgressEntry.findMany({
        where: {
          branchId,
          studentId: { in: studentIds },
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: {
            gte: new Date(`${fromDate}T00:00:00.000Z`),
            lte: new Date(`${toDate}T23:59:59.999Z`),
          },
          type: TYPE_TO_ENUM['New Lesson'],
          surahId: { not: null },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        select: { studentId: true, surahId: true, fromAyah: true, toAyah: true },
      }),
    ]);

    const [target, actual] = await Promise.all([
      this.countPageCompletion(
        scheduleRows.map((r) => ({
          groupKey: r.studentId,
          surahId: r.surahId!,
          fromAyah: r.fromAyah!,
          toAyah: r.toAyah!,
        })),
      ),
      this.countPageCompletion(
        progressRows.map((r) => ({
          groupKey: r.studentId,
          surahId: r.surahId!,
          fromAyah: r.fromAyah!,
          toAyah: r.toAyah!,
        })),
      ),
    ]);

    for (const studentId of studentIds) {
      result.set(studentId, {
        targetPages: target.pages.get(studentId) ?? 0,
        targetLines: target.lines.get(studentId) ?? 0,
        actualPages: actual.pages.get(studentId) ?? 0,
        actualLines: actual.lines.get(studentId) ?? 0,
      });
    }
    return result;
  }

  /** Cumulative (no lower date bound) version of targetAndActualPagesBatch — see cumulativeTargetAndActualAyahsBatch's doc comment for why this exists alongside the windowed one. */
  private async cumulativeTargetAndActualPagesBatch(
    branchId: string,
    studentIds: string[],
    toDate: string,
  ): Promise<
    Map<string, { targetPages: number; targetLines: number; actualPages: number; actualLines: number }>
  > {
    const result = new Map<
      string,
      { targetPages: number; targetLines: number; actualPages: number; actualLines: number }
    >();
    if (studentIds.length === 0) return result;
    for (const id of studentIds) {
      result.set(id, { targetPages: 0, targetLines: 0, actualPages: 0, actualLines: 0 });
    }

    const [scheduleRows, progressRows] = await Promise.all([
      this.prisma.surahHifdhStudentSchedule.findMany({
        where: {
          studentId: { in: studentIds },
          scheduledDate: { lte: new Date(toDate) },
          surahId: { not: null },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        select: { studentId: true, surahId: true, fromAyah: true, toAyah: true },
      }),
      this.prisma.studentSurahProgressEntry.findMany({
        where: {
          branchId,
          studentId: { in: studentIds },
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: { lte: new Date(`${toDate}T23:59:59.999Z`) },
          type: TYPE_TO_ENUM['New Lesson'],
          surahId: { not: null },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        select: { studentId: true, surahId: true, fromAyah: true, toAyah: true },
      }),
    ]);

    const [target, actual] = await Promise.all([
      this.countPageCompletion(
        scheduleRows.map((r) => ({
          groupKey: r.studentId,
          surahId: r.surahId!,
          fromAyah: r.fromAyah!,
          toAyah: r.toAyah!,
        })),
      ),
      this.countPageCompletion(
        progressRows.map((r) => ({
          groupKey: r.studentId,
          surahId: r.surahId!,
          fromAyah: r.fromAyah!,
          toAyah: r.toAyah!,
        })),
      ),
    ]);

    for (const studentId of studentIds) {
      result.set(studentId, {
        targetPages: target.pages.get(studentId) ?? 0,
        targetLines: target.lines.get(studentId) ?? 0,
        actualPages: actual.pages.get(studentId) ?? 0,
        actualLines: actual.lines.get(studentId) ?? 0,
      });
    }
    return result;
  }

  /**
   * Same shape as targetAndActualAyahsBatch, but with no lower bound on
   * either side — everything scheduled/completed up to and including
   * toDate counts, starting from each student's own schedule/progress
   * history. This is the "as of this date" cumulative figure (how much
   * should/does the student have done in total by toDate), as opposed to
   * the windowed [fromDate, toDate] figure which only reflects pace during
   * that specific slice and hides any backlog from before fromDate.
   */
  private async cumulativeTargetAndActualAyahsBatch(
    branchId: string,
    studentIds: string[],
    toDate: string,
  ): Promise<Map<string, { targetAyahs: number; actualAyahs: number }>> {
    const result = new Map<
      string,
      { targetAyahs: number; actualAyahs: number }
    >();
    if (studentIds.length === 0) return result;
    for (const id of studentIds) result.set(id, { targetAyahs: 0, actualAyahs: 0 });

    const [scheduleGroups, progressGroups] = await Promise.all([
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          scheduledDate: { lte: new Date(toDate) },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        _sum: { fromAyah: true, toAyah: true },
        _count: { _all: true },
      }),
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId'],
        where: {
          branchId,
          studentId: { in: studentIds },
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: { lte: new Date(`${toDate}T23:59:59.999Z`) },
          type: TYPE_TO_ENUM['New Lesson'],
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        _sum: { fromAyah: true, toAyah: true },
        _count: { _all: true },
      }),
    ]);

    for (const g of scheduleGroups) {
      const entry = result.get(g.studentId);
      if (entry) {
        entry.targetAyahs =
          (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0) + g._count._all;
      }
    }
    for (const g of progressGroups) {
      const entry = result.get(g.studentId);
      if (entry) {
        entry.actualAyahs =
          (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0) + g._count._all;
      }
    }
    return result;
  }

  /** Batch halqa + teacher name lookup — for Top Performing's "All Halqas" card, which needs the teacher to credit, not just the halqa name. */
  private async studentHalqaTeacherBatch(studentIds: string[]) {
    const result = new Map<
      string,
      { halqaId: string; halqaName: string; teacherName: string | null }
    >();
    if (studentIds.length === 0) return result;
    const memberships = await this.prisma.halqaStudent.findMany({
      where: { studentId: { in: studentIds }, removedAt: null },
      include: {
        halqa: {
          select: {
            id: true,
            name: true,
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    for (const m of memberships) {
      if (m.halqa && !result.has(m.studentId)) {
        const teacherName = m.halqa.teacher
          ? [m.halqa.teacher.user.firstName, m.halqa.teacher.user.lastName].filter(Boolean).join(' ')
          : null;
        result.set(m.studentId, {
          halqaId: m.halqa.id,
          halqaName: m.halqa.name,
          teacherName: teacherName || null,
        });
      }
    }
    return result;
  }

  /** Batch "current class" lookup — the student's own active enrollment,
   * preferring the current academic year if more than one active
   * enrollment exists (shouldn't normally happen, but mirrors the same
   * "most-current-year-wins" tie-break used for the Add Student class
   * picker's dedup, for the same underlying reason: this schema allows a
   * student to carry more than one active enrollment row). */
  private async studentCurrentClassBatch(studentIds: string[]) {
    const result = new Map<string, string>();
    if (studentIds.length === 0) return result;
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId: { in: studentIds }, status: 'ACTIVE' },
      include: {
        academicClassSectionYear: {
          include: {
            academicYear: { select: { isCurrent: true } },
            academicClassSection: {
              include: { academicClass: true, academicSection: true },
            },
          },
        },
      },
    });
    for (const e of enrollments) {
      const name = `${e.academicClassSectionYear.academicClassSection.academicClass.name} - ${e.academicClassSectionYear.academicClassSection.academicSection.name}`;
      const existing = result.has(e.studentId);
      if (!existing || e.academicClassSectionYear.academicYear.isCurrent) {
        result.set(e.studentId, name);
      }
    }
    return result;
  }


  /** A Mushaf Juz' is 20 pages — folds every complete 20-page block of a
   * raw page count into a Juz', leaving only the under-20 remainder as
   * pages (same convention as the Activity Report PDF summary). */
  private splitPagesIntoJuzAndPages(totalPages: number): { juz: number; pages: number } {
    const pages = Math.max(0, totalPages);
    return { juz: Math.floor(pages / 20), pages: pages % 20 };
  }

  // ── studentsWithPendingTargets ───────────────────────────────────────
  async studentsWithPendingTargets(
    branchId: string,
    userId: string,
    query: GetStudentsTargetQueryDto,
  ) {
    if (!query.from_date || !query.to_date) {
      throw new BadRequestException({
        status: 'error',
        message: 'from_date and to_date are required',
      });
    }
    const minDeficit = query.min_deficit ? Number(query.min_deficit) : 0;
    // No cap by default — this is an actionable admin worklist, not a
    // leaderboard, so silently hiding qualifying students past 20 was the
    // wrong default now that the underlying query is safely aggregated
    // (bounded per-student cost, not the old raw-row-duplication problem).
    // An explicit ?limit= is still honored for callers that want one.
    const limit = query.limit ? Number(query.limit) : null;

    const students = await this.activeStudentsForReport(
      branchId,
      query.halqa_id,
      undefined,
      userId,
    );
    const studentIds = students.map((s) => s.id);
    const [ayahsByStudent, cumulativeByStudent, pagesByStudent, cumulativePagesByStudent] =
      await Promise.all([
        this.targetAndActualAyahsBatch(branchId, studentIds, query.from_date, query.to_date),
        this.cumulativeTargetAndActualAyahsBatch(branchId, studentIds, query.to_date),
        this.targetAndActualPagesBatch(branchId, studentIds, query.from_date, query.to_date),
        this.cumulativeTargetAndActualPagesBatch(branchId, studentIds, query.to_date),
      ]);

    // Eligibility (has a real target at all, and deficit exceeds the
    // threshold) is still ayah-based — it's a precise, cheap aggregate and
    // the filter semantics don't change just because the DISPLAYED unit
    // did. Ranking, however, now follows the same pages figure shown on
    // screen, or the order wouldn't match what's displayed.
    const qualifying = students
      .map((student) => {
        const { targetAyahs, actualAyahs } = ayahsByStudent.get(student.id)!;
        const cumulative = cumulativeByStudent.get(student.id)!;
        const pages = pagesByStudent.get(student.id)!;
        const cumulativePages = cumulativePagesByStudent.get(student.id)!;
        return {
          student,
          targetAyahs,
          actualAyahs,
          deficit: targetAyahs - actualAyahs,
          cumulativeTargetAyahs: cumulative.targetAyahs,
          cumulativeActualAyahs: cumulative.actualAyahs,
          pages,
          cumulativePages,
          deficitPages: Math.max(0, pages.targetPages - pages.actualPages),
          cumulativeDeficitPages: Math.max(
            0,
            cumulativePages.targetPages - cumulativePages.actualPages,
          ),
        };
      })
      .filter((r) => r.targetAyahs !== 0 && r.deficit > minDeficit)
      .sort((a, b) => b.deficitPages - a.deficitPages);
    const limited = limit !== null ? qualifying.slice(0, limit) : qualifying;

    const limitedIds = limited.map((r) => r.student.id);
    const [halqaByStudent, classByStudent] = await Promise.all([
      this.studentHalqaTeacherBatch(limitedIds),
      this.studentCurrentClassBatch(limitedIds),
    ]);
    const result = await Promise.all(
      limited.map(async (r) => {
        const halqa = halqaByStudent.get(r.student.id);
        const deficitSplit = this.splitPagesIntoJuzAndPages(r.deficitPages);
        const cumulativeDeficitSplit = this.splitPagesIntoJuzAndPages(r.cumulativeDeficitPages);
        return {
          student: {
            ...(await this.formatStudentBasic(r.student)),
            halqa: halqa ? { id: halqa.halqaId, name: halqa.halqaName } : null,
            teacher_name: halqa?.teacherName ?? null,
            class_name: classByStudent.get(r.student.id) ?? null,
          },
          target_ayahs: r.targetAyahs,
          actual_ayahs: r.actualAyahs,
          deficit_ayahs: r.deficit,
          cumulative_target_ayahs: r.cumulativeTargetAyahs,
          cumulative_actual_ayahs: r.cumulativeActualAyahs,
          cumulative_deficit_ayahs: r.cumulativeTargetAyahs - r.cumulativeActualAyahs,
          target_pages: r.pages.targetPages,
          target_lines: r.pages.targetLines,
          actual_pages: r.pages.actualPages,
          actual_lines: r.pages.actualLines,
          deficit_pages: r.deficitPages,
          deficit_juz: deficitSplit.juz,
          deficit_pages_remainder: deficitSplit.pages,
          cumulative_target_pages: r.cumulativePages.targetPages,
          cumulative_actual_pages: r.cumulativePages.actualPages,
          cumulative_deficit_pages: r.cumulativeDeficitPages,
          cumulative_deficit_juz: cumulativeDeficitSplit.juz,
          cumulative_deficit_pages_remainder: cumulativeDeficitSplit.pages,
        };
      }),
    );

    return {
      status: 'success',
      data: {
        period: { from_date: query.from_date, to_date: query.to_date },
        filters: {
          halqa_id: query.halqa_id ?? null,
          min_deficit: minDeficit,
          limit,
        },
        total_students_with_pending: result.length,
        students: result,
      },
    };
  }

  // ── getStudentsExceededTarget ────────────────────────────────────────
  async getStudentsExceededTarget(
    branchId: string,
    userId: string,
    query: GetStudentsTargetQueryDto,
  ) {
    const now = new Date();
    const fromDate =
      query.from_date ??
      formatDateOnly(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      )!;
    const toDate = query.to_date ?? formatDateOnly(now)!;
    const minExcess = query.min_excess ? Number(query.min_excess) : 0;
    // No cap by default — see studentsWithPendingTargets for why (this is
    // an actionable admin worklist, and the query underneath is already
    // safely aggregated regardless of how many students qualify).
    const limit = query.limit ? Number(query.limit) : null;

    const students = await this.activeStudentsForReport(
      branchId,
      query.halqa_id,
      undefined,
      userId,
    );
    const studentIds = students.map((s) => s.id);
    const [ayahsByStudent, cumulativeByStudent, pagesByStudent, cumulativePagesByStudent] =
      await Promise.all([
        this.targetAndActualAyahsBatch(branchId, studentIds, fromDate, toDate),
        this.cumulativeTargetAndActualAyahsBatch(branchId, studentIds, toDate),
        this.targetAndActualPagesBatch(branchId, studentIds, fromDate, toDate),
        this.cumulativeTargetAndActualPagesBatch(branchId, studentIds, toDate),
      ]);

    const qualifying = students
      .map((student) => {
        const { targetAyahs, actualAyahs } = ayahsByStudent.get(student.id)!;
        const cumulative = cumulativeByStudent.get(student.id)!;
        const pages = pagesByStudent.get(student.id)!;
        const cumulativePages = cumulativePagesByStudent.get(student.id)!;
        return {
          student,
          targetAyahs,
          actualAyahs,
          excess: actualAyahs - targetAyahs,
          cumulativeTargetAyahs: cumulative.targetAyahs,
          cumulativeActualAyahs: cumulative.actualAyahs,
          pages,
          cumulativePages,
          excessPages: Math.max(0, pages.actualPages - pages.targetPages),
          cumulativeExcessPages: Math.max(
            0,
            cumulativePages.actualPages - cumulativePages.targetPages,
          ),
        };
      })
      .filter((r) => r.excess > minExcess)
      .sort((a, b) => b.excessPages - a.excessPages);
    const limited = limit !== null ? qualifying.slice(0, limit) : qualifying;

    const limitedIds = limited.map((r) => r.student.id);
    const [halqaByStudent, classByStudent] = await Promise.all([
      this.studentHalqaTeacherBatch(limitedIds),
      this.studentCurrentClassBatch(limitedIds),
    ]);
    const result = await Promise.all(
      limited.map(async (r) => {
        const halqa = halqaByStudent.get(r.student.id);
        const excessSplit = this.splitPagesIntoJuzAndPages(r.excessPages);
        const cumulativeExcessSplit = this.splitPagesIntoJuzAndPages(r.cumulativeExcessPages);
        return {
          student: {
            ...(await this.formatStudentBasic(r.student)),
            halqa: halqa ? { id: halqa.halqaId, name: halqa.halqaName } : null,
            teacher_name: halqa?.teacherName ?? null,
            class_name: classByStudent.get(r.student.id) ?? null,
          },
          target_ayahs: r.targetAyahs,
          actual_ayahs: r.actualAyahs,
          excess_ayahs: r.excess,
          cumulative_target_ayahs: r.cumulativeTargetAyahs,
          cumulative_actual_ayahs: r.cumulativeActualAyahs,
          cumulative_excess_ayahs: r.cumulativeActualAyahs - r.cumulativeTargetAyahs,
          target_pages: r.pages.targetPages,
          target_lines: r.pages.targetLines,
          actual_pages: r.pages.actualPages,
          actual_lines: r.pages.actualLines,
          excess_pages: r.excessPages,
          excess_juz: excessSplit.juz,
          excess_pages_remainder: excessSplit.pages,
          cumulative_target_pages: r.cumulativePages.targetPages,
          cumulative_actual_pages: r.cumulativePages.actualPages,
          cumulative_excess_pages: r.cumulativeExcessPages,
          cumulative_excess_juz: cumulativeExcessSplit.juz,
          cumulative_excess_pages_remainder: cumulativeExcessSplit.pages,
        };
      }),
    );

    return {
      status: 'success',
      data: {
        period: { from_date: fromDate, to_date: toDate },
        filters: {
          halqa_id: query.halqa_id ?? null,
          min_excess: minExcess,
          limit,
        },
        total_students_exceeded: result.length,
        students: result,
      },
    };
  }

  // ── getFullProgressReport ────────────────────────────────────────────
  async getFullProgressReport(
    branchId: string,
    userId: string,
    query: GetFullProgressReportQueryDto,
  ) {
    const { from_date: fromDate, to_date: toDate } = query;
    const types = query.types ?? [];
    // 'Evaluation' is a StudentExam day, not a ProgressEntryType — split it
    // out before anything touches TYPE_TO_ENUM. Selecting it alongside
    // lesson types ANDs them together (a day only counts if every selected
    // lesson type AND an exam both happened that day), same combining rule
    // already used across multiple lesson types.
    const requiresEvaluation = types.includes('Evaluation');
    const lessonTypeLabels = types.filter((t) => t !== 'Evaluation');
    const rangeLength =
      Math.round(
        (new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000,
      ) + 1;
    const recentFrom = formatDateOnly(
      new Date(Date.now() - rangeLength * 86400000),
    )!;
    const recentTo = formatDateOnly(new Date())!;

    const students = await this.activeStudentsForReport(
      branchId,
      query.halqa_id,
      query.student_id,
      userId,
    );

    // Was: one groupBy(studentId) to find candidates, then a findMany with
    // distinct:['type'] PER CANDIDATE STUDENT to check how many distinct
    // types they had — called twice per report (range + "recent"), so a
    // full "all halqas" load was 2 x (1 + N) queries. A single
    // groupBy(['studentId', 'type']) already returns one row per
    // (student, type) pair that has ≥1 matching record — grouping those
    // rows by studentId in JS gives the exact same distinct-type-count
    // check with 2 total queries instead of 2 x (1 + N).
    // Lesson-type-only — 'Evaluation' has no row in studentSurahProgressEntry
    // to group on, so it can't factor into this particular pre-filter. That
    // only makes this narrowing slightly less tight when 'Evaluation' is
    // selected (see the completedWhere.studentId scoping below); the actual
    // per-day classification further down still applies it correctly.
    const getStudentsWithAllTypes = async (
      start: string,
      end: string,
    ): Promise<string[] | null> => {
      if (lessonTypeLabels.length === 0) return null;
      const grouped = await this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId', 'type'],
        where: {
          branchId,
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: {
            gte: new Date(`${start}T00:00:00.000Z`),
            lte: new Date(`${end}T23:59:59.999Z`),
          },
          type: { in: lessonTypeLabels.map((t) => TYPE_TO_ENUM[t]) },
        },
      });
      const typesByStudent = new Map<string, Set<string>>();
      for (const g of grouped) {
        if (!g.type) continue;
        const set = typesByStudent.get(g.studentId) ?? new Set<string>();
        set.add(g.type);
        typesByStudent.set(g.studentId, set);
      }
      return [...typesByStudent.entries()]
        .filter(([, set]) => set.size >= lessonTypeLabels.length)
        .map(([id]) => id);
    };

    const studentsWithAllTypesInRange = await getStudentsWithAllTypes(
      fromDate,
      toDate,
    );
    const studentsWithAllTypesRecent = await getStudentsWithAllTypes(
      recentFrom,
      recentTo,
    );
    const hasAllTypesRecent = new Set(studentsWithAllTypesRecent ?? []);
    const isInactiveRecent = (studentId: string) =>
      !hasAllTypesRecent.has(studentId);

    const completedWhere: Prisma.StudentSurahProgressEntryWhereInput = {
      branchId,
      status: { in: ['COMPLETED', 'VERIFIED'] },
      completedAt: {
        gte: new Date(`${fromDate}T00:00:00.000Z`),
        lte: new Date(`${toDate}T23:59:59.999Z`),
      },
    };
    // Each active filter (types, halqa, student) narrows the allowed student
    // set independently — intersect them rather than letting a later filter
    // silently overwrite an earlier one, which used to make halqa_id a no-op
    // whenever a lesson type was also selected (the default state), since
    // completedWhere.studentId was already set by the types filter by then.
    let allowedStudentIds: Set<string> | null = null;
    const intersectAllowed = (ids: string[]) => {
      allowedStudentIds = allowedStudentIds
        ? new Set(ids.filter((id) => allowedStudentIds!.has(id)))
        : new Set(ids);
    };
    if (lessonTypeLabels.length > 0) {
      completedWhere.type = { in: lessonTypeLabels.map((t) => TYPE_TO_ENUM[t]) };
      intersectAllowed(studentsWithAllTypesInRange ?? []);
    }
    if (query.halqa_id) {
      const memberIds = (
        await this.prisma.halqaStudent.findMany({
          where: { halqaId: query.halqa_id, removedAt: null },
          select: { studentId: true },
        })
      ).map((m) => m.studentId);
      intersectAllowed(memberIds);
    }
    // A Teacher caller is always restricted to their own halqa(s), even
    // with no explicit halqa_id (the "All Halqas" filter option) — without
    // this, the completed/"Recited" tab fell back to branch-wide with no
    // halqa restriction at all whenever the caller didn't pass one, leaking
    // other halqas' students into a teacher's "All" view.
    const ownHalqaIds = await this.ownHalqaIdsIfTeacher(userId);
    if (ownHalqaIds !== null) {
      const ownMemberIds = (
        await this.prisma.halqaStudent.findMany({
          where: { halqaId: { in: ownHalqaIds }, removedAt: null },
          select: { studentId: true },
        })
      ).map((m) => m.studentId);
      intersectAllowed(ownMemberIds);
    }
    if (query.student_id) {
      intersectAllowed([query.student_id]);
    }
    if (allowedStudentIds) {
      completedWhere.studentId = { in: [...allowedStudentIds] };
    }

    // Holidays/leaves fetched alongside completedRecords (not after, like
    // before) — the new every-school-day bucketing below needs per-day
    // leave data for ALL students up front, not just the ones left over
    // once "has a completed record" was already decided.
    const [completedRecords, holidays, approvedLeaves, exams] = await Promise.all([
      this.prisma.studentSurahProgressEntry.findMany({
        where: completedWhere,
        include: { surah: { select: SURAH_SELECT } },
      }),
      this.prisma.calendarDay.findMany({
        where: {
          branchId,
          isHoliday: true,
          date: {
            gte: new Date(`${fromDate}T00:00:00.000Z`),
            lte: new Date(`${toDate}T23:59:59.999Z`),
          },
        },
      }),
      this.prisma.studentLeave.findMany({
        where: {
          studentId: { in: students.map((s) => s.id) },
          status: 'APPROVED',
          leaveDate: {
            gte: new Date(`${fromDate}T00:00:00.000Z`),
            lte: new Date(`${toDate}T23:59:59.999Z`),
          },
        },
      }),
      // A day with an exam/Mukammal but no lesson progress shouldn't break
      // an otherwise-every-day-recited student's Completed status — see
      // the `coveredOnDay` check below. Doesn't affect the Not Recited
      // check, which stays about actual lesson recitation.
      this.prisma.studentExam.findMany({
        where: {
          studentId: { in: students.map((s) => s.id) },
          examDate: {
            gte: new Date(`${fromDate}T00:00:00.000Z`),
            lte: new Date(`${toDate}T23:59:59.999Z`),
          },
        },
        select: { studentId: true, examDate: true },
      }),
    ]);

    // Every school day in the selected range (holidays excluded) — the
    // bucketing below requires EVERY one of these to be covered before a
    // student counts as Completed or On Leave; see the classification loop
    // further down for the exact rule.
    const holidayDates = new Set(holidays.map((h) => formatDateOnly(h.date)!));
    const schoolDays: string[] = [];
    for (
      const d = new Date(`${fromDate}T00:00:00.000Z`);
      d <= new Date(`${toDate}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const dateStr = formatDateOnly(d)!;
      if (!holidayDates.has(dateStr)) schoolDays.push(dateStr);
    }

    // Per-day leave coverage, per student — used by the classification loop
    // to check "on leave every school day in range", not just "on leave
    // for at least one day" like the old single-leave lookup did.
    const leaveDaysByStudent = new Map<string, Set<string>>();
    for (const leave of approvedLeaves) {
      const d = formatDateOnly(leave.leaveDate)!;
      const set = leaveDaysByStudent.get(leave.studentId) ?? new Set<string>();
      set.add(d);
      leaveDaysByStudent.set(leave.studentId, set);
    }
    // Kept for the On Leave list's reason/is_half_day display — same "first
    // match wins" representative-leave behavior as before this change.
    const firstLeaveByStudent = new Map<string, (typeof approvedLeaves)[number]>();
    for (const leave of approvedLeaves) {
      if (!firstLeaveByStudent.has(leave.studentId)) {
        firstLeaveByStudent.set(leave.studentId, leave);
      }
    }

    const examDaysByStudent = new Map<string, Set<string>>();
    for (const exam of exams) {
      const d = formatDateOnly(exam.examDate)!;
      const set = examDaysByStudent.get(exam.studentId) ?? new Set<string>();
      set.add(d);
      examDaysByStudent.set(exam.studentId, set);
    }

    // Real page-completion (not a flat ayahs/15 or lines/15 approximation)
    // — see countPageCompletionByStudent's doc comment for why "pages" is
    // a count of fully-covered physical pages, and "lines" is leftover
    // progress on pages not yet complete.
    const trueCompletion = await this.countPageCompletionByStudent(
      completedRecords
        .filter(
          (r): r is typeof r & { surahId: string; fromAyah: number; toAyah: number } =>
            r.surahId !== null && r.fromAyah !== null && r.toAyah !== null,
        )
        .map((r) => ({
          studentId: r.studentId,
          surahId: r.surahId,
          fromAyah: r.fromAyah,
          toAyah: r.toAyah,
        })),
    );

    const studentsCompletedMap = new Map<string, Record<string, unknown>>();
    // studentId -> day -> set of lesson-type labels completed that day —
    // the classification loop below uses this to check "recited every
    // school day" (and, when a type filter is active, "recited ALL
    // selected types on that day") rather than "recited at least once
    // somewhere in the range".
    const completedDaysByStudent = new Map<string, Map<string, Set<string>>>();
    const studentBasicCache = new Map<string, Record<string, unknown>>();
    const getBasic = async (studentId: string) => {
      if (studentBasicCache.has(studentId))
        return studentBasicCache.get(studentId)!;
      const student =
        students.find((s) => s.id === studentId) ??
        (await this.prisma.student.findUnique({
          where: { id: studentId },
          include: { user: { select: { email: true } } },
        }));
      const basic = student
        ? await this.formatStudentBasic(student)
        : { id: studentId };
      studentBasicCache.set(studentId, basic);
      return basic;
    };

    for (const record of completedRecords) {
      const sid = record.studentId;
      const ayahs = this.ayahSpan(record.fromAyah, record.toAyah);
      if (!studentsCompletedMap.has(sid)) {
        studentsCompletedMap.set(sid, {
          student: await getBasic(sid),
          is_inactive_recent: isInactiveRecent(sid),
          lesson_types: new Map<
            string,
            { type: string; total_ayahs: number; entries_count: number }
          >(),
          total_ayahs_today: 0,
          surahs_completed: [] as Record<string, unknown>[],
        });
      }
      const entry = studentsCompletedMap.get(sid)!;
      entry.total_ayahs_today = (entry.total_ayahs_today as number) + ayahs;
      const lessonTypes = entry.lesson_types as Map<
        string,
        { type: string; total_ayahs: number; entries_count: number }
      >;
      const typeLabel = record.type ? TYPE_TO_LEGACY[record.type] : 'Lesson';
      if (record.completedAt) {
        const day = formatDateOnly(record.completedAt)!;
        const dayMap = completedDaysByStudent.get(sid) ?? new Map<string, Set<string>>();
        const typesThatDay = dayMap.get(day) ?? new Set<string>();
        typesThatDay.add(typeLabel);
        dayMap.set(day, typesThatDay);
        completedDaysByStudent.set(sid, dayMap);
      }
      const lt = lessonTypes.get(typeLabel) ?? {
        type: typeLabel,
        total_ayahs: 0,
        entries_count: 0,
      };
      lt.total_ayahs += ayahs;
      lt.entries_count += 1;
      lessonTypes.set(typeLabel, lt);
      const surahsCompleted = entry.surahs_completed as Record<
        string,
        unknown
      >[];
      if (
        record.surah &&
        !surahsCompleted.some(
          (s) => (s as { id: string }).id === record.surah!.id,
        )
      ) {
        surahsCompleted.push(serializeSurahBasic(record.surah));
      }
    }

    // Per-day "did this student meet the required type(s) on this school
    // day" check — with no lesson-type filter, any completed record that
    // day counts; with one, every selected lesson type must appear that day
    // (an "AND" across types, same as the old all-types-somewhere-in-range
    // rule, just now evaluated per day instead of across the whole range).
    // When 'Evaluation' is also selected, that day additionally needs an
    // exam/Mukammal — ANDed in alongside whatever lesson types were chosen.
    const recitedOnDay = (studentId: string, day: string): boolean => {
      if (requiresEvaluation && !(examDaysByStudent.get(studentId)?.has(day) ?? false)) {
        return false;
      }
      if (lessonTypeLabels.length === 0) {
        // Evaluation-only filter (no lesson types selected) — the exam
        // check above already decided this day; nothing left to require.
        if (requiresEvaluation) return true;
        const typesThatDay = completedDaysByStudent.get(studentId)?.get(day);
        return !!typesThatDay && typesThatDay.size > 0;
      }
      const typesThatDay = completedDaysByStudent.get(studentId)?.get(day);
      if (!typesThatDay) return false;
      return lessonTypeLabels.every((t) => typesThatDay.has(t));
    };
    // A day with an exam/Mukammal but no lesson progress still counts as
    // "covered" for the every-day Completed check — a student who recited
    // every day except one, where that one day was an evaluation day
    // instead, shouldn't be knocked out of Completed over it. Doesn't
    // affect recitedOnDay/recitedDays, which the Not Recited check below
    // still uses unchanged (that check is about actual recitation).
    const coveredOnDay = (studentId: string, day: string): boolean =>
      recitedOnDay(studentId, day) ||
      (examDaysByStudent.get(studentId)?.has(day) ?? false);

    // Classification, strict and mutually exclusive — a student lands in
    // EXACTLY one of the three buckets, or none at all:
    //   - Completed: recited (or had an exam/Mukammal) on every school day
    //     in the range.
    //   - On Leave: on approved leave every school day in the range
    //     (checked first — a student on leave the whole range shouldn't
    //     fall through to "Not Recited" just because recitedDays is 0).
    //   - Not Recited: recited on zero school days in the range (whatever
    //     mix of leave/exam/plain-missed days made up the rest doesn't
    //     matter).
    //   - Partial (recited some days, missed some, not fully covered by
    //     leave or an exam day) is deliberately excluded from all three
    //     lists — mixing a "some days" student into either bucket would
    //     misrepresent them as fully present or fully absent, which is
    //     worse than omitting them for a date-range view.
    const totalSchoolDays = schoolDays.length;
    const completedList: Record<string, unknown>[] = [];
    const pendingList: Record<string, unknown>[] = [];
    const onLeaveList: Record<string, unknown>[] = [];
    let totalAyahsBucketed = 0;
    let totalPagesBucketed = 0;
    let totalLinesBucketed = 0;

    for (const student of students) {
      const recitedDays = totalSchoolDays === 0
        ? 0
        : schoolDays.filter((day) => recitedOnDay(student.id, day)).length;
      const coveredDays = totalSchoolDays === 0
        ? 0
        : schoolDays.filter((day) => coveredOnDay(student.id, day)).length;
      const leaveDaySet = leaveDaysByStudent.get(student.id);
      const leaveDays = totalSchoolDays === 0
        ? 0
        : schoolDays.filter((day) => leaveDaySet?.has(day)).length;

      if (totalSchoolDays > 0 && coveredDays === totalSchoolDays) {
        const entry = studentsCompletedMap.get(student.id);
        if (entry) {
          completedList.push({
            ...entry,
            lesson_types: [...(entry.lesson_types as Map<string, unknown>).values()],
            total_pages_today: trueCompletion.pages.get(student.id) ?? 0,
            total_lines_today: trueCompletion.lines.get(student.id) ?? 0,
          });
          totalAyahsBucketed += entry.total_ayahs_today as number;
          totalPagesBucketed += trueCompletion.pages.get(student.id) ?? 0;
          totalLinesBucketed += trueCompletion.lines.get(student.id) ?? 0;
        } else {
          // Every school day covered entirely by exams, with zero actual
          // lesson progress at all (studentsCompletedMap only has entries
          // built from completedRecords) — still Completed, just with a
          // minimal/empty progress summary rather than silently dropped.
          completedList.push({
            student: await getBasic(student.id),
            is_inactive_recent: isInactiveRecent(student.id),
            lesson_types: [],
            total_ayahs_today: 0,
            surahs_completed: [],
            total_pages_today: 0,
            total_lines_today: 0,
          });
        }
      } else if (totalSchoolDays > 0 && leaveDays === totalSchoolDays) {
        const leave = firstLeaveByStudent.get(student.id);
        onLeaveList.push({
          student: await getBasic(student.id),
          leave_date: leave ? formatDateOnly(leave.leaveDate) : null,
          reason: leave?.reason ?? null,
          is_half_day: leave?.isHalfDay ?? false,
        });
      } else if (totalSchoolDays > 0 && recitedDays === 0) {
        pendingList.push({
          student: await getBasic(student.id),
          is_inactive_recent: isInactiveRecent(student.id),
        });
      }
      // else: partial — recited some days, not all, not fully on leave —
      // excluded from every bucket, see comment above.
    }

    return {
      status: 'success',
      data: {
        date_range: { from_date: fromDate, to_date: toDate },
        inactive_lookback_days: rangeLength,
        filters: {
          halqa_id: query.halqa_id ?? null,
          student_id: query.student_id ?? null,
          types,
        },
        completed: {
          total_students: completedList.length,
          total_ayahs_marked: totalAyahsBucketed,
          total_pages_marked: totalPagesBucketed,
          total_lines_marked: totalLinesBucketed,
          students: completedList,
        },
        pending: { total_students: pendingList.length, students: pendingList },
        on_leave: {
          total_students: onLeaveList.length,
          students: onLeaveList,
        },
      },
    };
  }

  // ── getAttendanceReport ──────────────────────────────────────────────
  /**
   * There's no dedicated "mark attendance" flow for students in this app —
   * the Attendance table stays essentially unused for them. Only an
   * approved Leave counts as Absent; every other school day counts as
   * Present, whether or not the student actually recited that day (tracked
   * separately as "not recited" — a Present sub-status, not an absence).
   * Holidays are excluded from the day count entirely. Percentage is
   * present / (present + absent), i.e. present / total_school_days since
   * absent === leave here.
   */
  async getAttendanceReport(
    branchId: string,
    userId: string,
    query: GetAttendanceReportQueryDto,
  ) {
    const { from_date: fromDate, to_date: toDate } = query;
    const students = await this.activeStudentsForReport(
      branchId,
      query.halqa_id,
      query.student_id,
      userId,
    );
    const studentIds = students.map((s) => s.id);
    const start = new Date(`${fromDate}T00:00:00.000Z`);
    const end = new Date(`${toDate}T23:59:59.999Z`);

    const [presentEntries, leaves, holidays] = await Promise.all([
      this.prisma.studentSurahProgressEntry.findMany({
        where: {
          branchId,
          studentId: { in: studentIds },
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: { gte: start, lte: end },
        },
        select: { studentId: true, completedAt: true },
      }),
      this.prisma.studentLeave.findMany({
        where: {
          studentId: { in: studentIds },
          status: 'APPROVED',
          leaveDate: { gte: start, lte: end },
        },
      }),
      this.prisma.calendarDay.findMany({
        where: { branchId, isHoliday: true, date: { gte: start, lte: end } },
      }),
    ]);

    const holidayDates = new Set(
      holidays.map((h) => formatDateOnly(h.date)!),
    );

    const presentByStudent = new Map<string, Set<string>>();
    for (const e of presentEntries) {
      if (!e.completedAt) continue;
      const d = formatDateOnly(e.completedAt)!;
      if (holidayDates.has(d)) continue;
      const set = presentByStudent.get(e.studentId) ?? new Set<string>();
      set.add(d);
      presentByStudent.set(e.studentId, set);
    }

    const leaveByStudent = new Map<string, Set<string>>();
    for (const l of leaves) {
      const d = formatDateOnly(l.leaveDate)!;
      if (holidayDates.has(d)) continue;
      const set = leaveByStudent.get(l.studentId) ?? new Set<string>();
      set.add(d);
      leaveByStudent.set(l.studentId, set);
    }

    const schoolDays: string[] = [];
    for (
      const d = new Date(start);
      d <= end;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const dateStr = formatDateOnly(d)!;
      if (!holidayDates.has(dateStr)) schoolDays.push(dateStr);
    }

    // Building the per-day array for every student is only worth the cost
    // when a single student is in view (the detail sheet) — for a broad
    // "all halqas" list this was allocating students × school-days objects
    // on every call and measurably slowing the report down.
    const includeDailyBreakdown = !!query.student_id;

    const results = await Promise.all(
      students.map(async (student) => {
        const presentDates = presentByStudent.get(student.id) ?? new Set();
        const leaveDates = leaveByStudent.get(student.id) ?? new Set();
        let recited = 0;
        let notRecited = 0;
        let leave = 0;
        const dailyBreakdown: {
          date: string;
          status: 'leave' | 'present_recited' | 'present_not_recited';
        }[] = [];
        for (const day of schoolDays) {
          if (leaveDates.has(day)) {
            leave += 1;
            if (includeDailyBreakdown) dailyBreakdown.push({ date: day, status: 'leave' });
          } else if (presentDates.has(day)) {
            recited += 1;
            if (includeDailyBreakdown) dailyBreakdown.push({ date: day, status: 'present_recited' });
          } else {
            notRecited += 1;
            if (includeDailyBreakdown) dailyBreakdown.push({ date: day, status: 'present_not_recited' });
          }
        }
        const present = recited + notRecited;
        // Only Leave counts against attendance — a Present-but-not-recited
        // day is still Present, so the denominator is every school day.
        const attendancePercentage =
          schoolDays.length > 0
            ? Math.round((present / schoolDays.length) * 10000) / 100
            : 0;
        return {
          student: await this.formatStudentBasic(student),
          total_present: present,
          total_recited: recited,
          total_not_recited: notRecited,
          total_absent: leave,
          total_leave: leave,
          attendance_percentage: attendancePercentage,
          daily_breakdown: dailyBreakdown,
        };
      }),
    );

    return {
      status: 'success',
      data: {
        date_range: { from_date: fromDate, to_date: toDate },
        total_school_days: schoolDays.length,
        filters: {
          halqa_id: query.halqa_id ?? null,
          student_id: query.student_id ?? null,
        },
        students: results,
      },
    };
  }

  // ── getTopStudents ───────────────────────────────────────────────────
  async getTopStudents(
    branchId: string,
    userId: string,
    query: GetTopStudentsQueryDto,
  ) {
    // Defaults to New Lesson only — the mobile client never sends a types
    // filter, so this used to silently combine New + Old + Juzh into one
    // ranking/total ("Top Performing" showed e.g. 605 pages for a student
    // who'd completed the whole Quran in New Lesson (588) plus some Old
    // Lesson revision (17) on top, next to another student showing a
    // flat 588 with no Old Lesson at all — not wrong, but not what was
    // wanted here). An explicit types filter still overrides this.
    const types = query.types ?? ['New Lesson'];
    // No cap unless the caller explicitly asks for one — the mobile client
    // never passes this, and capping at 10 silently hid everyone past that
    // from "Top Performing" instead of showing the full ranked list.
    const requestedLimit = query.limit ? Number(query.limit) : null;

    const where: Prisma.StudentSurahProgressEntryWhereInput = {
      branchId,
      status: { in: ['COMPLETED', 'VERIFIED'] },
      completedAt: {
        gte: new Date(`${query.from_date}T00:00:00.000Z`),
        lte: new Date(`${query.to_date}T23:59:59.999Z`),
      },
      ...(types.length > 0 && {
        type: { in: types.map((t) => TYPE_TO_ENUM[t]) },
      }),
    };

    // A Teacher caller is restricted to their own halqa's students
    // regardless of what halqa_id/student_id they pass — an id outside
    // that set resolves to "no results", not "every student in the branch".
    const ownHalqaIds = await this.ownHalqaIdsIfTeacher(userId);
    const effectiveHalqaIds =
      ownHalqaIds === null
        ? query.halqa_id
          ? [query.halqa_id]
          : null
        : query.halqa_id
          ? ownHalqaIds.filter((id) => id === query.halqa_id)
          : ownHalqaIds;

    // rosterIds is every student who should appear in the list — not just
    // those with a matching entry, and not just those with a *rankable*
    // one (a student whose only activity is a cross-surah Old/Juzh range
    // has no plain fromAyah/toAyah to sum, so without this they'd be
    // invisible even though they recited plenty). Rank by ayahs where
    // computable, 0 otherwise — "show everyone" beats "only show who's
    // easy to rank".
    let rosterIds: string[];
    if (effectiveHalqaIds !== null) {
      const memberIds = (
        await this.prisma.halqaStudent.findMany({
          where: { halqaId: { in: effectiveHalqaIds }, removedAt: null },
          select: { studentId: true },
        })
      ).map((m) => m.studentId);
      where.studentId =
        query.student_id && !memberIds.includes(query.student_id)
          ? { in: [] }
          : (query.student_id ?? { in: memberIds });
      rosterIds = query.student_id
        ? memberIds.includes(query.student_id)
          ? [query.student_id]
          : []
        : memberIds;
    } else if (query.student_id) {
      where.studentId = query.student_id;
      rosterIds = [query.student_id];
    } else {
      const allStudents = await this.prisma.student.findMany({
        where: { branchId, status: 'ACTIVE' },
        select: { id: true },
      });
      rosterIds = allStudents.map((s) => s.id);
    }

    // Rank by the SAME real page/line completion shown in the UI, not raw
    // ayah count — a student who recited more ayahs can still complete
    // FEWER full physical pages than one who recited fewer, longer ayahs,
    // so ranking by ayah count while displaying pages/lines produced an
    // order that visibly contradicted the figure shown (e.g. a "4 pages 14
    // lines" student outranking a "6 pages 3 lines" one). The groupBy
    // below is the same cheap one-row-per-student aggregation as before
    // (for the ayah count still shown in the response); the findMany next
    // to it only selects 4 scalar columns with no relations, so it stays
    // far lighter than the `include`-based query that used to OOM this
    // process (see the detail-phase comment below) even though it now
    // covers the whole roster, not just the eventual winners.
    const [rankable, rankablePageEntries] = await Promise.all([
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId'],
        where: { ...where, fromAyah: { not: null }, toAyah: { not: null } },
        _sum: { fromAyah: true, toAyah: true },
        _count: { _all: true },
      }),
      this.prisma.studentSurahProgressEntry.findMany({
        where: {
          ...where,
          surahId: { not: null },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        select: { studentId: true, surahId: true, fromAyah: true, toAyah: true },
      }),
    ]);
    const ayahsByStudent = new Map(
      rankable.map((g) => [
        g.studentId,
        (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0) + g._count._all,
      ]),
    );
    const { pages: rankPagesByStudent, lines: rankLinesByStudent } =
      await this.countPageCompletion(
        rankablePageEntries.map((e) => ({
          groupKey: e.studentId,
          surahId: e.surahId!,
          fromAyah: e.fromAyah!,
          toAyah: e.toAyah!,
        })),
      );

    const ranked = rosterIds
      .map((studentId) => ({
        studentId,
        totalAyahs: ayahsByStudent.get(studentId) ?? 0,
        pages: rankPagesByStudent.get(studentId) ?? 0,
        lines: rankLinesByStudent.get(studentId) ?? 0,
      }))
      .sort((a, b) => b.pages - a.pages || b.lines - a.lines);
    const topRanked =
      requestedLimit !== null ? ranked.slice(0, requestedLimit) : ranked;
    const topStudentIds = topRanked.map((r) => r.studentId);

    if (topStudentIds.length === 0) {
      return {
        status: 'success',
        data: {
          date_range: { from_date: query.from_date, to_date: query.to_date },
          filters: {
            halqa_id: query.halqa_id ?? null,
            student_id: query.student_id ?? null,
            types,
          },
          top_students: {
            limit: requestedLimit,
            total_students_with_records: rosterIds.length,
            students: [],
          },
        },
      };
    }

    // Detail phase, entirely aggregated — no raw studentSurahProgressEntry
    // rows are ever pulled into Node here. The previous version did
    // findMany({ include: { student: {...}, surah: {...} } }) over every
    // matching entry row for the winners: since `include` embeds a full
    // copy of the joined row on *every* entry row (not once per student),
    // a winner with hundreds of entries in range meant hundreds of
    // duplicated student+surah objects in memory. That's what actually
    // spiked this process to ~1.8-1.9GB and got it OOM-killed by the OS —
    // groupBy keeps every result here bounded by `limit` (students) x a
    // small constant (lesson types, or the ~114 surahs in the Quran),
    // never by how much history a student has.
    const winnerWhere: Prisma.StudentSurahProgressEntryWhereInput = {
      ...where,
      studentId: { in: topStudentIds },
    };
    const [
      entryCountByStudent,
      typeCounts,
      typeAyahSums,
      typeCompletionDates,
      surahTouches,
      winnerStudents,
      halqaTeacherByStudent,
      branchSettings,
      branch,
      ayahEntriesForLines,
    ] = await Promise.all([
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId'],
        where: winnerWhere,
        _count: { _all: true },
      }),
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId', 'type'],
        where: winnerWhere,
        _count: { _all: true },
      }),
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId', 'type'],
        where: { ...winnerWhere, fromAyah: { not: null }, toAyah: { not: null } },
        _sum: { fromAyah: true, toAyah: true },
      }),
      // Distinct-day counts aren't expressible via groupBy (it groups on
      // exact column values, not a date-truncated one), so this pulls raw
      // (studentId, type, completedAt) rows to dedupe calendar days in
      // Node — same bounded-to-winners shape as the other detail-phase
      // queries above, just not reducible to a single aggregate.
      this.prisma.studentSurahProgressEntry.findMany({
        where: winnerWhere,
        select: { studentId: true, type: true, completedAt: true },
      }),
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId', 'surahId'],
        where: { ...winnerWhere, surahId: { not: null } },
      }),
      this.prisma.student.findMany({
        where: { id: { in: topStudentIds } },
        include: { user: { select: { email: true } } },
      }),
      this.studentHalqaTeacherBatch(topStudentIds),
      this.prisma.branchSettings.findUnique({ where: { branchId } }),
      this.prisma.branch.findUnique({ where: { id: branchId } }),
      // The (surahId, fromAyah, toAyah) per entry — needed to compute real
      // completed lines via SurahAyahPageLine below, not just a flat
      // ayahs/15 approximation. Bounded to winners only, same as
      // typeCompletionDates above — never by how much history a student has.
      this.prisma.studentSurahProgressEntry.findMany({
        where: { ...winnerWhere, fromAyah: { not: null }, toAyah: { not: null }, surahId: { not: null } },
        select: { studentId: true, surahId: true, type: true, fromAyah: true, toAyah: true },
      }),
    ]);
    // The academy/center name — never the Halqa's name (see the identical
    // comment in students.service.ts's buildActivityTimeline).
    const centerName = branchSettings?.displayName || branch?.name || null;

    const uniqueSurahIds = [
      ...new Set(surahTouches.map((s) => s.surahId).filter((id): id is string => !!id)),
    ];
    // Bounded by the ~114 surahs in the Quran regardless of history size.
    const surahs = uniqueSurahIds.length
      ? await this.prisma.surah.findMany({
          where: { id: { in: uniqueSurahIds } },
          select: SURAH_SELECT,
        })
      : [];
    const surahById = new Map(surahs.map((s) => [s.id, s]));

    const entryCountMap = new Map(
      entryCountByStudent.map((g) => [g.studentId, g._count._all]),
    );
    const typeAyahMap = new Map<string, Map<string, number>>();
    for (const g of typeAyahSums) {
      if (!g.type) continue;
      const perType = typeAyahMap.get(g.studentId) ?? new Map<string, number>();
      const sum = (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0);
      perType.set(g.type, sum);
      typeAyahMap.set(g.studentId, perType);
    }
    const typesByStudent = new Map<string, Map<string, number>>();
    for (const g of typeCounts) {
      if (!g.type) continue;
      const perType = typesByStudent.get(g.studentId) ?? new Map<string, number>();
      perType.set(g.type, g._count._all);
      typesByStudent.set(g.studentId, perType);
    }
    const daysByStudentType = new Map<string, Map<string, Set<string>>>();
    for (const e of typeCompletionDates) {
      if (!e.type || !e.completedAt) continue;
      const perType = daysByStudentType.get(e.studentId) ?? new Map<string, Set<string>>();
      const days = perType.get(e.type) ?? new Set<string>();
      days.add(e.completedAt.toISOString().slice(0, 10));
      perType.set(e.type, days);
      daysByStudentType.set(e.studentId, perType);
    }
    const surahsByStudent = new Map<string, string[]>();
    for (const g of surahTouches) {
      if (!g.surahId) continue;
      const list = surahsByStudent.get(g.studentId) ?? [];
      list.push(g.surahId);
      surahsByStudent.set(g.studentId, list);
    }
    const studentById = new Map(winnerStudents.map((s) => [s.id, s]));

    // Real page-completion lookup (SurahAyahPageLine — same table
    // /configuration/surah-ayah-page-lines manages) — see
    // countPageCompletion's doc comment for why "pages" is a count of
    // fully-covered physical pages (each page's own real content total,
    // not a flat 15) and "lines" is leftover progress on pages not yet
    // complete. Per-type breakdown needs its own grouping
    // (`${studentId}|${type}`) rather than being derived by summing from
    // the overall total, since the SAME physical page can legitimately
    // appear under more than one type (e.g. a page revised as Old Lesson
    // that was also where New Lesson left off).
    const pageEntries = ayahEntriesForLines
      .filter(
        (e): e is typeof e & { surahId: string; fromAyah: number; toAyah: number } =>
          e.surahId !== null && e.fromAyah !== null && e.toAyah !== null,
      )
      .map((e) => ({ studentId: e.studentId, type: e.type ?? '', surahId: e.surahId, fromAyah: e.fromAyah, toAyah: e.toAyah }));
    const [overall, byType] = await Promise.all([
      this.countPageCompletion(pageEntries.map((e) => ({ groupKey: e.studentId, ...e }))),
      this.countPageCompletion(pageEntries.map((e) => ({ groupKey: `${e.studentId}|${e.type}`, ...e }))),
    ]);
    const totalPagesByStudent = overall.pages;
    const totalLinesByStudent = overall.lines;

    const typePagesByStudent = new Map<string, Map<string, number>>();
    const typeLinesByStudent = new Map<string, Map<string, number>>();
    for (const [groupKey, pages] of byType.pages) {
      const sep = groupKey.indexOf('|');
      const studentId = groupKey.slice(0, sep);
      const type = groupKey.slice(sep + 1);
      if (!type) continue;
      const perType = typePagesByStudent.get(studentId) ?? new Map<string, number>();
      perType.set(type, pages);
      typePagesByStudent.set(studentId, perType);
    }
    for (const [groupKey, lines] of byType.lines) {
      const sep = groupKey.indexOf('|');
      const studentId = groupKey.slice(0, sep);
      const type = groupKey.slice(sep + 1);
      if (!type) continue;
      const perType = typeLinesByStudent.get(studentId) ?? new Map<string, number>();
      perType.set(type, lines);
      typeLinesByStudent.set(studentId, perType);
    }

    const topStudents = await Promise.all(
      topRanked.map(async (r) => {
        const student = studentById.get(r.studentId);
        const halqaTeacher = halqaTeacherByStudent.get(r.studentId);
        const entryTypeCounts = typesByStudent.get(r.studentId) ?? new Map();
        const entryTypeAyahs = typeAyahMap.get(r.studentId) ?? new Map();
        const entryTypePages = typePagesByStudent.get(r.studentId) ?? new Map();
        const entryTypeLines = typeLinesByStudent.get(r.studentId) ?? new Map();
        const entryTypeDays = daysByStudentType.get(r.studentId) ?? new Map();
        const lessonTypes = [...entryTypeCounts.entries()].map(([type, count]) => {
          const ayahs = entryTypeAyahs.get(type) ?? 0;
          return {
            type: TYPE_TO_LEGACY[type as keyof typeof TYPE_TO_LEGACY] ?? type,
            total_ayahs: ayahs,
            pages: entryTypePages.get(type) ?? 0,
            lines: entryTypeLines.get(type) ?? 0,
            days: entryTypeDays.get(type)?.size ?? 0,
            entries_count: count,
          };
        });
        const surahsCompleted = (surahsByStudent.get(r.studentId) ?? [])
          .map((id) => surahById.get(id))
          .filter((s): s is NonNullable<typeof s> => !!s)
          .map((s) => serializeSurahBasic(s));
        return {
          student: student
            ? await this.formatStudentBasic(student)
            : { id: r.studentId },
          total_ayahs: r.totalAyahs,
          pages: totalPagesByStudent.get(r.studentId) ?? 0,
          lines: totalLinesByStudent.get(r.studentId) ?? 0,
          total_entries: entryCountMap.get(r.studentId) ?? 0,
          lesson_types: lessonTypes,
          surahs_completed: surahsCompleted,
          halqa_name: halqaTeacher?.halqaName ?? null,
          teacher_name: halqaTeacher?.teacherName ?? null,
          center_name: centerName,
        };
      }),
    );

    return {
      status: 'success',
      data: {
        date_range: { from_date: query.from_date, to_date: query.to_date },
        filters: {
          halqa_id: query.halqa_id ?? null,
          student_id: query.student_id ?? null,
          types,
        },
        top_students: {
          limit: requestedLimit,
          total_students_with_records: rosterIds.length,
          students: topStudents,
        },
      },
    };
  }

  // ── getCenterPerformanceReport ────────────────────────────────────────
  /**
   * Center-wise Monthly Performance Report: every ACTIVE student in the
   * branch, grouped by their Halqa teacher, graded Excellent/Good/Average/
   * "Need to Improve" by how far their schedule pace (computeSchedulePacingBatch's
   * actual% vs. expected%, identical math to computeSchedulePacing's
   * per-student version) has drifted. A branch-wide admin report — unlike
   * activeStudentsForReport (used by the other reports in this file), it is
   * deliberately NOT scoped to a Teacher caller's own halqa(s); it has no
   * userId/caller context at all, by design (see task spec).
   *
   * Optional `halqaId` switches to a single-Halqa mode: same grading, same
   * rows shape, but narrowed to just that Halqa's roster, with its one
   * teacher resolved directly (teacher_name) instead of grouped per-student,
   * and no teacher_summaries (nothing to summarize across a single team).
   */
  async getCenterPerformanceReport(
    branchId: string,
    month: number,
    year: number,
    halqaId?: string,
  ) {
    // Month boundaries as [gte monthStart, lt nextMonthStart) — mirrors
    // MasterCalendarService.monthRange, the existing month-int-based
    // date-range convention elsewhere in this codebase (this file's other
    // reports take explicit from_date/to_date strings instead, so there's
    // no local month/year precedent to match).
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));

    const [branch, branchSettings, workingDayRows, branchStudents] = await Promise.all([
      this.prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
      this.prisma.branchSettings.findUnique({ where: { branchId } }),
      this.prisma.calendarDay.findMany({
        where: { branchId, isWorkingDay: true, date: { gte: monthStart, lt: monthEnd } },
        select: { id: true },
      }),
      this.prisma.student.findMany({ where: { branchId, status: 'ACTIVE' } }),
    ]);
    // The academy/center name — never the Halqa's name (see the identical
    // comment on getTopStudents' centerName, above).
    const centerName = branchSettings?.displayName || branch?.name || null;
    const workingDays = workingDayRows.length;

    // Halqa-scoped mode: resolve this one Halqa's own teacher directly
    // (every row shares it, so there's no per-student grouping to do for
    // it) and narrow the branch's active students down to just this
    // Halqa's roster. `halqa.findFirst` is scoped to `branchId` so a
    // halqaId belonging to another branch can never pull that branch's
    // teacher into this report; as a second, independent safeguard the
    // roster below is also intersected with `branchStudents` (already
    // filtered to this branch's ACTIVE students), never trusted on its own.
    let halqaTeacherName: string | null = null;
    let students = branchStudents;
    if (halqaId) {
      const [halqa, roster] = await Promise.all([
        this.prisma.halqa.findFirst({
          where: { id: halqaId, branchId },
          include: {
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        }),
        this.prisma.halqaStudent.findMany({
          where: { halqaId, removedAt: null },
          select: { studentId: true },
        }),
      ]);
      const resolvedName = halqa?.teacher
        ? [halqa.teacher.user.firstName, halqa.teacher.user.lastName]
            .filter(Boolean)
            .join(' ')
        : null;
      // Always resolves to a non-null string once halqaId was given — the
      // Flutter PDF branches scoped-vs-unscoped rendering on
      // `teacher_name != null`, so a Halqa with no teacher assigned must
      // still read as "scoped, teacher unknown" ('Unassigned'), the same
      // fallback the unscoped report already uses per-student below, never
      // fall through to null (which would make it look unscoped).
      halqaTeacherName = resolvedName || 'Unassigned';
      const rosterIds = new Set(roster.map((r) => r.studentId));
      students = branchStudents.filter((s) => rosterIds.has(s.id));
    }

    const studentIds = students.map((s) => s.id);

    // studentId: { in: [] } is a safe no-op query (returns []) when the
    // branch (or, in halqa-scoped mode, the Halqa) has no active students —
    // no need to special-case it here.
    const [halqaTeacherByStudent, pacingByStudent, newLessonEntries] = await Promise.all([
      // Per-student teacher lookup is only needed for the unscoped report's
      // per-teacher grouping/summary — halqa-scoped mode already has its
      // one teacher resolved above, so skip the extra query.
      halqaId
        ? Promise.resolve(
            new Map<string, { halqaName: string; teacherName: string | null }>(),
          )
        : this.studentHalqaTeacherBatch(studentIds),
      this.computeSchedulePacingBatch(studentIds),
      this.prisma.studentSurahProgressEntry.findMany({
        where: {
          studentId: { in: studentIds },
          type: ProgressEntryType.NEW_LESSON,
          status: { in: [ProgressEntryStatus.COMPLETED, ProgressEntryStatus.VERIFIED] },
          completedAt: { gte: monthStart, lt: monthEnd },
          surahId: { not: null },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        select: { studentId: true, surahId: true, fromAyah: true, toAyah: true },
      }),
    ]);

    // Real page-completion (see countPageCompletionByStudent) for this
    // calendar month's New Lesson entries only, per student.
    const newLessonCompletion = await this.countPageCompletionByStudent(
      newLessonEntries.filter(
        (e): e is typeof e & { surahId: string; fromAyah: number; toAyah: number } =>
          e.surahId !== null && e.fromAyah !== null && e.toAyah !== null,
      ),
    );

    const GRADE_RANK: Record<string, number> = {
      Excellent: 0,
      Good: 1,
      Average: 2,
      'Need to Improve': 3,
    };
    const gradeFor = (diff: number): string => {
      if (diff >= 0) return 'Excellent';
      if (diff >= -3) return 'Good';
      if (diff >= -6) return 'Average';
      return 'Need to Improve';
    };

    const rowEntries = students.map((student) => {
      // Halqa-scoped mode: every row shares the one teacher already
      // resolved above. Unscoped mode: students with no halqa membership,
      // or whose halqa has no teacher assigned, have nowhere else to be
      // bucketed for this report's teacher-grouped rows/summary — grouped
      // under "Unassigned" rather than silently dropped.
      const teacherName = halqaId
        ? halqaTeacherName!
        : halqaTeacherByStudent.get(student.id)?.teacherName ?? 'Unassigned';
      const pacing =
        pacingByStudent.get(student.id) ??
        ({ actualProgressPercentage: 0, expectedProgressPercentage: 0 } as const);
      const diff = pacing.actualProgressPercentage - pacing.expectedProgressPercentage;
      const grade = gradeFor(diff);
      const pages = newLessonCompletion.pages.get(student.id) ?? 0;
      const lines = newLessonCompletion.lines.get(student.id) ?? 0;
      return {
        teacherName,
        studentName: student.name,
        studentId: student.id,
        newLessonDisplay: formatPagesDisplay(pages, lines),
        actualPercentage: pacing.actualProgressPercentage,
        expectedPercentage: pacing.expectedProgressPercentage,
        grade,
      };
    });

    // Teacher name alphabetical, then grade-rank within each teacher, then
    // actual% descending (best performer first) within the same grade band
    // — alphabetical-by-name was the original tiebreak, but that put a
    // lower-recited student above a higher-recited one whenever its name
    // happened to sort first, which read as "wrong order" to anyone
    // actually comparing performance. Student name is now only the final
    // tiebreak for an exact percentage tie.
    rowEntries.sort((a, b) => {
      const teacherCompare = a.teacherName.localeCompare(b.teacherName);
      if (teacherCompare !== 0) return teacherCompare;
      const rankDiff = GRADE_RANK[a.grade] - GRADE_RANK[b.grade];
      if (rankDiff !== 0) return rankDiff;
      const pctDiff = b.actualPercentage - a.actualPercentage;
      if (pctDiff !== 0) return pctDiff;
      return a.studentName.localeCompare(b.studentName);
    });

    // One continuous SL.NO. across the whole table, assigned after the
    // full sort above (not reset per teacher).
    const rows = rowEntries.map((r, index) => ({
      sl_no: index + 1,
      teacher_name: r.teacherName,
      student_name: r.studentName,
      student_id: r.studentId,
      new_lesson_display: r.newLessonDisplay,
      actual_percentage: r.actualPercentage,
      expected_percentage: r.expectedPercentage,
      grade: r.grade,
    }));

    // Halqa-scoped mode has only one team in scope, so there's nothing to
    // summarize across teachers — skip the aggregation entirely rather than
    // compute a single-row summary nobody asked for (cheaper, and the
    // Flutter PDF already skips rendering the section when this is empty).
    let teacherSummaries: {
      teacher_name: string;
      total_students: number;
      exceeded_count: number;
      team_grade: string;
    }[] = [];
    if (!halqaId) {
      const byTeacher = new Map<string, { total: number; exceeded: number }>();
      for (const r of rowEntries) {
        const entry = byTeacher.get(r.teacherName) ?? { total: 0, exceeded: 0 };
        entry.total += 1;
        if (r.grade === 'Excellent') entry.exceeded += 1;
        byTeacher.set(r.teacherName, entry);
      }
      // Admin-configurable (Super Admin, via TeacherGradingThresholdsController)
      // global ratio cutoffs, queried directly here rather than through an
      // injected TeacherGradingThresholdsService — this method has no other
      // reason to depend on the `configuration` module tree, and a direct
      // singleton-row lookup is simpler than wiring up a new module import
      // for one field read. Falls back to the Prisma model's own defaults
      // (1.0/0.7/0.4) if no row has been created yet.
      const thresholds = await this.prisma.teacherGradingThresholds.findFirst();
      const excellentMin = thresholds?.excellentMin ?? 1.0;
      const goodMin = thresholds?.goodMin ?? 0.7;
      const averageMin = thresholds?.averageMin ?? 0.4;
      const teamGradeFor = (ratio: number): string => {
        if (ratio >= excellentMin) return 'Excellent';
        if (ratio >= goodMin) return 'Good';
        if (ratio >= averageMin) return 'Average';
        return 'Need to Improve';
      };
      teacherSummaries = [...byTeacher.entries()]
        .map(([teacherName, { total, exceeded }]) => ({
          teacherName,
          total,
          exceeded,
          ratio: total > 0 ? exceeded / total : 0,
        }))
        .sort((a, b) => {
          const rankDiff = GRADE_RANK[teamGradeFor(a.ratio)] - GRADE_RANK[teamGradeFor(b.ratio)];
          if (rankDiff !== 0) return rankDiff;
          if (b.ratio !== a.ratio) return b.ratio - a.ratio;
          return a.teacherName.localeCompare(b.teacherName);
        })
        .map((t) => ({
          teacher_name: t.teacherName,
          total_students: t.total,
          exceeded_count: t.exceeded,
          team_grade: teamGradeFor(t.ratio),
        }));
    }

    const totalStudents = students.length;
    const exceededTarget = rowEntries.filter((r) => r.grade === 'Excellent').length;
    const notCompleted = totalStudents - exceededTarget;

    return {
      status: 'success',
      data: {
        center_name: centerName,
        teacher_name: halqaId ? halqaTeacherName : null,
        month,
        year,
        working_days: workingDays,
        total_students: totalStudents,
        exceeded_target: exceededTarget,
        not_completed: notCompleted,
        rows,
        teacher_summaries: teacherSummaries,
      },
    };
  }

  // ── updateProgress ───────────────────────────────────────────────────
  async updateProgress(
    branchId: string,
    userId: string,
    dto: UpdateProgressDto,
  ) {
    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: { id: { in: dto.progress_ids }, branchId },
    });
    if (entries.length === 0) {
      throw new NotFoundException({
        status: 'error',
        message: 'No valid progress records found',
      });
    }

    let updatedCount = 0;
    const unmarkedByStudent = new Map<string, Set<string>>();
    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        if (dto.unmark) {
          if (entry.status === 'COMPLETED' || entry.status === 'VERIFIED') {
            await tx.studentSurahProgressEntry.update({
              where: { id: entry.id },
              data: {
                status: 'NOT_STARTED',
                grade: null,
                remarks: null,
                completedAt: null,
                verifiedById: null,
                remarkFile: null,
                lastUpdatedById: userId,
              },
            });
            updatedCount += 1;
            if (entry.surahId) {
              const set = unmarkedByStudent.get(entry.studentId) ?? new Set<string>();
              set.add(entry.surahId);
              unmarkedByStudent.set(entry.studentId, set);
            }
          }
          continue;
        }

        await tx.studentSurahProgressEntry.update({
          where: { id: entry.id },
          data: {
            ...(dto.grade !== undefined && { grade: GRADE_TO_ENUM[dto.grade] }),
            ...(dto.remarks !== undefined && { remarks: dto.remarks }),
            ...(dto.completed_at && {
              completedAt: new Date(dto.completed_at),
            }),
            lastUpdatedById: userId,
          },
        });
        updatedCount += 1;
      }

      for (const [studentId, surahIds] of unmarkedByStudent) {
        await this.unsyncScheduleEntries(tx, studentId, [...surahIds]);
      }
    });

    return {
      status: 'success',
      message: dto.unmark
        ? 'Ayahs unmarked successfully'
        : 'Progress updated successfully',
      data: { updated_count: updatedCount, progress_ids: dto.progress_ids },
    };
  }

  // ── deleteProgress ───────────────────────────────────────────────────
  async deleteProgress(branchId: string, id: string) {
    const entry = await this.prisma.studentSurahProgressEntry.findFirst({
      where: { id, branchId },
    });
    if (!entry) {
      throw new NotFoundException({
        status: 'error',
        message: 'Progress entry not found',
      });
    }
    if (entry.day !== null) {
      throw new BadRequestException({
        status: 'error',
        message:
          'This entry is part of the fixed lesson schedule and cannot be deleted — unmark it instead.',
      });
    }
    await this.prisma.studentSurahProgressEntry.delete({ where: { id } });
  }
}

function serializeSurahBasic(surah: {
  id: string;
  number: number;
  nameArabic: string;
  nameEnglish: string;
  totalAyahs?: number;
}) {
  return {
    id: surah.id,
    surah_number: surah.number,
    name_ar: surah.nameArabic,
    name_en: surah.nameEnglish,
    ...(surah.totalAyahs !== undefined && { total_ayahs: surah.totalAyahs }),
  };
}
