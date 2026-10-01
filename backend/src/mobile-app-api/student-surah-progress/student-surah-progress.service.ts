import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
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
function gravatarUrl(id: string): string {
  const hash = createHash('md5').update(id).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}.png?s=200&d=mp`;
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
  }) {
    return {
      id: student.id,
      name: student.name,
      email: student.user?.email ?? null,
      student_id: student.id,
      image_url: student.imageUrl ?? gravatarUrl(student.id),
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
      };
    }

    const rows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: { studentId, scheduleNo },
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

    let totalLines = 0;
    let actualLines = 0;
    let expectedLines = 0;
    let latestDate: Date | null = null;
    // Pace is measured from actual practice, not the schedule's nominal
    // start date — a student whose schedule was generated months ago but
    // who only just started completing lessons should be paced from when
    // they actually started, not averaged over the months they hadn't
    // begun yet (that crushes linesPerDay toward zero and produces
    // multi-century projections for anyone early in a long-dormant plan).
    let earliestCompletedAt: Date | null = null;
    // Separately, the most recent completion — used to detect a student
    // who's simply gone quiet recently, independent of how long they've
    // been on the schedule overall.
    let latestCompletedAt: Date | null = null;

    for (const row of rows) {
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

    // Project a finish date from the student's own actual pace so far —
    // lines actually completed ÷ days elapsed since they first actually
    // completed something. A raw extrapolation here can produce nonsense
    // (a projection centuries out for someone who's barely started, or an
    // implausibly fast one if a backlog got bulk-marked with the same
    // timestamp) — those aren't useful dates, they're noise, so below we
    // classify the estimate's reliability and only hand back a date when
    // it's actually meaningful. Otherwise the caller gets a status + plain
    // -language reason instead of a number that looks broken.
    const MIN_DAYS_FOR_ESTIMATE = 1; // any real activity span is enough to show a first estimate
    const MAX_PLAUSIBLE_LINES_PER_DAY = 50; // generous ceiling for real daily memorization pace — a genuine data-quality guard, not a "too surprising" filter
    const INACTIVE_AFTER_DAYS = 30; // schedule rows are daily with no built-in rest days, so any sustained gap is a real gap

    let projectedCompletionDate: string | null = null;
    let paceStatus: string;
    let paceMessage: string;

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
    } else {
      const daysElapsed = Math.max(
        1,
        Math.round(
          (today.getTime() - earliestCompletedAt.getTime()) / 86400000,
        ) + 1,
      );
      const linesPerDay = actualLines / daysElapsed;

      if (daysElapsed < MIN_DAYS_FOR_ESTIMATE) {
        paceStatus = 'insufficient_data';
        paceMessage = 'Not enough recent activity yet to estimate a pace';
      } else if (linesPerDay > MAX_PLAUSIBLE_LINES_PER_DAY) {
        paceStatus = 'unrealistic_pace';
        paceMessage = 'Recent marking looks unusually fast — may need review';
      } else {
        // Now that pace is measured from real practice history (not the
        // schedule's nominal start date), a far-out date is genuinely
        // correct information for a slow-but-real student, not noise to
        // hide — so it's shown as an actual date rather than a vague "far
        // behind" placeholder. The UI compares it against the target date
        // itself to label how far ahead/behind that implies.
        const remainingLines = Math.max(0, totalLines - actualLines);
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
      paceMessage,
    };
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
      orderBy: { completedAt: 'desc' },
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

    const progressData = entries.map((entry) => ({
      ...serializeEntry(entry),
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
        select: { studentId: true, type: true, updatedAt: true },
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
    for (const [studentId, history] of lessonHistoryByStudent) {
      const lastNewIndex = history.map((h) => h.type).lastIndexOf('NEW_LESSON');
      const cycleSlice = lastNewIndex >= 0 ? history.slice(lastNewIndex) : history;
      const distinctTypes: string[] = [];
      for (const h of cycleSlice) {
        const label = TYPE_TO_LEGACY[h.type as ProgressEntryType];
        if (!distinctTypes.includes(label)) distinctTypes.push(label);
      }
      currentCycleTypesByStudent.set(studentId, distinctTypes);
    }

    const [leaves, exams, holidays] = await Promise.all([
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
    ]);
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

      const studentData: Record<string, unknown> = {
        student: await this.formatStudentBasic(student),
        activities,
        total_ayahs_today: totalAyahsToday,
        lesson_types: [...lessonTypesMap.values()],
        surahs_completed: surahsCompleted,
        is_on_leave: hasLeaveToday,
        // Persists across days — see currentCycleTypesByStudent above.
        current_cycle_types: currentCycleTypesByStudent.get(student.id) ?? [],
        evaluation,
        remarks: remarkTexts.length > 0 ? remarkTexts.join('; ') : null,
      };

      // "Completed" requires every lesson type in the student's current
      // cycle (current_cycle_types above) to have a record today, not just
      // one of them — a student who's only marked New Lesson today but
      // whose active cycle also includes Old/Juzh is still mid-day, not
      // done, and belongs in Pending.
      const todaysTypes = new Set(lessonTypesMap.keys());
      const cycleTypes = currentCycleTypesByStudent.get(student.id) ?? [];
      const hasAllCycleTypesToday =
        cycleTypes.length > 0 && cycleTypes.every((t) => todaysTypes.has(t));

      if (records && records.length > 0 && hasAllCycleTypesToday) {
        completedStudents.push(studentData);
      } else if (hasLeaveToday) {
        onLeaveStudents.push(studentData);
      } else if (!hasExamToday) {
        pendingStudents.push(studentData);
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
  private async targetAndActualAyahsBatch(
    branchId: string,
    studentIds: string[],
    fromDate: string,
    toDate: string,
    type?: string,
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
          ...(type && { type: TYPE_TO_ENUM[type] }),
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

  /** Batch halqa lookup for a small, already-bounded set of students (e.g. the final `limit`-sized result page) — avoids one findFirst per student. */
  private async studentHalqasBatch(studentIds: string[]) {
    const result = new Map<
      string,
      { id: string; name: string; status: string }
    >();
    if (studentIds.length === 0) return result;
    const memberships = await this.prisma.halqaStudent.findMany({
      where: { studentId: { in: studentIds }, removedAt: null },
      include: { halqa: { select: { id: true, name: true, status: true } } },
    });
    for (const m of memberships) {
      if (m.halqa && !result.has(m.studentId)) {
        result.set(m.studentId, m.halqa);
      }
    }
    return result;
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
    const ayahsByStudent = await this.targetAndActualAyahsBatch(
      branchId,
      students.map((s) => s.id),
      query.from_date,
      query.to_date,
      query.type,
    );

    const qualifying = students
      .map((student) => {
        const { targetAyahs, actualAyahs } = ayahsByStudent.get(student.id)!;
        return { student, targetAyahs, actualAyahs, deficit: targetAyahs - actualAyahs };
      })
      .filter((r) => r.targetAyahs !== 0 && r.deficit > minDeficit)
      .sort((a, b) => b.deficit - a.deficit);
    const limited = limit !== null ? qualifying.slice(0, limit) : qualifying;

    const halqaByStudent = await this.studentHalqasBatch(
      limited.map((r) => r.student.id),
    );
    const result = await Promise.all(
      limited.map(async (r) => ({
        student: {
          ...(await this.formatStudentBasic(r.student)),
          halqa: halqaByStudent.get(r.student.id)
            ? {
                id: halqaByStudent.get(r.student.id)!.id,
                name: halqaByStudent.get(r.student.id)!.name,
              }
            : null,
        },
        target_ayahs: r.targetAyahs,
        actual_ayahs: r.actualAyahs,
        deficit_ayahs: r.deficit,
      })),
    );

    return {
      status: 'success',
      data: {
        period: { from_date: query.from_date, to_date: query.to_date },
        filters: {
          halqa_id: query.halqa_id ?? null,
          type: query.type ?? null,
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
    const ayahsByStudent = await this.targetAndActualAyahsBatch(
      branchId,
      students.map((s) => s.id),
      fromDate,
      toDate,
      query.type,
    );

    const qualifying = students
      .map((student) => {
        const { targetAyahs, actualAyahs } = ayahsByStudent.get(student.id)!;
        return { student, targetAyahs, actualAyahs, excess: actualAyahs - targetAyahs };
      })
      .filter((r) => r.excess > minExcess)
      .sort((a, b) => b.excess - a.excess);
    const limited = limit !== null ? qualifying.slice(0, limit) : qualifying;

    const halqaByStudent = await this.studentHalqasBatch(
      limited.map((r) => r.student.id),
    );
    const result = await Promise.all(
      limited.map(async (r) => ({
        student: {
          ...(await this.formatStudentBasic(r.student)),
          halqa: halqaByStudent.get(r.student.id)
            ? {
                id: halqaByStudent.get(r.student.id)!.id,
                name: halqaByStudent.get(r.student.id)!.name,
              }
            : null,
        },
        target_ayahs: r.targetAyahs,
        actual_ayahs: r.actualAyahs,
        excess_ayahs: r.excess,
      })),
    );

    return {
      status: 'success',
      data: {
        period: { from_date: fromDate, to_date: toDate },
        filters: {
          halqa_id: query.halqa_id ?? null,
          type: query.type ?? null,
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
    const getStudentsWithAllTypes = async (
      start: string,
      end: string,
    ): Promise<string[] | null> => {
      if (types.length === 0) return null;
      const grouped = await this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId', 'type'],
        where: {
          branchId,
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: {
            gte: new Date(`${start}T00:00:00.000Z`),
            lte: new Date(`${end}T23:59:59.999Z`),
          },
          type: { in: types.map((t) => TYPE_TO_ENUM[t]) },
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
        .filter(([, set]) => set.size >= types.length)
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
    if (types.length > 0) {
      completedWhere.type = { in: types.map((t) => TYPE_TO_ENUM[t]) };
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

    const completedRecords =
      await this.prisma.studentSurahProgressEntry.findMany({
        where: completedWhere,
        include: { surah: { select: SURAH_SELECT } },
      });

    const studentsCompletedMap = new Map<string, Record<string, unknown>>();
    let totalAyahs = 0;
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
      totalAyahs += ayahs;
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

    const completedList = [...studentsCompletedMap.values()].map((entry) => ({
      ...entry,
      lesson_types: [...(entry.lesson_types as Map<string, unknown>).values()],
    }));

    // Students on approved leave for this date range shouldn't be counted
    // as "not recited" — they're a separate bucket entirely, since they
    // weren't expected to recite in the first place.
    const approvedLeaves = await this.prisma.studentLeave.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        status: 'APPROVED',
        leaveDate: {
          gte: new Date(`${fromDate}T00:00:00.000Z`),
          lte: new Date(`${toDate}T23:59:59.999Z`),
        },
      },
    });
    const leaveByStudent = new Map<string, (typeof approvedLeaves)[number]>();
    for (const leave of approvedLeaves) {
      if (!leaveByStudent.has(leave.studentId)) {
        leaveByStudent.set(leave.studentId, leave);
      }
    }

    const pendingList: Record<string, unknown>[] = [];
    const onLeaveList: Record<string, unknown>[] = [];
    const studentsWithAllTypesSet = new Set(
      types.length > 0 ? (studentsWithAllTypesInRange ?? []) : [],
    );
    for (const student of students) {
      // When no type filter is active, "has a completed record in range"
      // is exactly what studentsCompletedMap already captured from
      // completedRecords (fetched once, above) — re-querying per student
      // here was a redundant N+1 asking the DB something we'd already
      // pulled into memory.
      const hasAllRequired =
        types.length === 0
          ? studentsCompletedMap.has(student.id)
          : studentsWithAllTypesSet.has(student.id);
      if (hasAllRequired) continue;

      const leave = leaveByStudent.get(student.id);
      if (leave) {
        onLeaveList.push({
          student: await getBasic(student.id),
          leave_date: formatDateOnly(leave.leaveDate),
          reason: leave.reason,
          is_half_day: leave.isHalfDay,
        });
      } else {
        pendingList.push({
          student: await getBasic(student.id),
          is_inactive_recent: isInactiveRecent(student.id),
        });
      }
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
          total_ayahs_marked: totalAyahs,
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
    const types = query.types ?? [];
    const limit = query.limit ? Number(query.limit) : 10;

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
    } else if (query.student_id) {
      where.studentId = query.student_id;
    }

    // Two-phase: rank with a cheap DB-side aggregation over every matching
    // row (groupBy — one row per student, no student/surah joins), then
    // only run the heavy detailed query (with joins) for the winners.
    // The previous single-pass version pulled every matching progress
    // entry for the whole branch into Node with full relations included —
    // fine for one halqa, but for "all halqas" over a wide date range that
    // was thousands of rows with joins on every request, which is exactly
    // what was driving the DB connection pool into "too many connections"
    // under concurrent admin usage. ayahSpan(from, to) = to - from + 1, so
    // sum(ayahSpan) decomposes algebraically into sum(to) - sum(from) +
    // count(*) — restricting to non-null from/to keeps that identity exact
    // (a null-range entry contributes 0 either way).
    const [rankable, distinctStudents] = await Promise.all([
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId'],
        where: { ...where, fromAyah: { not: null }, toAyah: { not: null } },
        _sum: { fromAyah: true, toAyah: true },
        _count: { _all: true },
      }),
      // Separate from `rankable` because a student whose only matching
      // entries have a null ayah range (Juz/Page-tracked progress) is
      // excluded from ranking but still has "records" for this count.
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId'],
        where,
      }),
    ]);

    const ranked = rankable
      .map((g) => ({
        studentId: g.studentId,
        totalAyahs:
          (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0) + g._count._all,
      }))
      .sort((a, b) => b.totalAyahs - a.totalAyahs);
    const topStudentIds = ranked.slice(0, limit).map((r) => r.studentId);

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
            limit,
            total_students_with_records: distinctStudents.length,
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
      surahTouches,
      winnerStudents,
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
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId', 'surahId'],
        where: { ...winnerWhere, surahId: { not: null } },
      }),
      this.prisma.student.findMany({
        where: { id: { in: topStudentIds } },
        include: { user: { select: { email: true } } },
      }),
    ]);

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
    const surahsByStudent = new Map<string, string[]>();
    for (const g of surahTouches) {
      if (!g.surahId) continue;
      const list = surahsByStudent.get(g.studentId) ?? [];
      list.push(g.surahId);
      surahsByStudent.set(g.studentId, list);
    }
    const studentById = new Map(winnerStudents.map((s) => [s.id, s]));

    // Academy convention (same one the PDF export uses): 15 lines per Mushaf
    // page, applied as a flat conversion of ayah count rather than a true
    // per-ayah line lookup (SurahAyahPageLine) — that table's per-ayah line
    // counts aren't constant, so summing them can't be done as a cheap DB
    // aggregate like ayahSpan can; it'd require pulling every matching row
    // per student, which is exactly the OOM pattern this endpoint was
    // rewritten to avoid (see the comment above the groupBy phase). Since
    // this is a fixed-ratio transform of total_ayahs, ranking by pages/lines
    // produces the identical order as ranking by ayahs — so the existing
    // cheap aggregation still correctly determines the top N.
    const toPagesLines = (ayahs: number) => ({
      pages: Math.trunc(ayahs / 15),
      lines: ayahs % 15,
    });

    const topStudents = await Promise.all(
      ranked.slice(0, limit).map(async (r) => {
        const student = studentById.get(r.studentId);
        const entryTypeCounts = typesByStudent.get(r.studentId) ?? new Map();
        const entryTypeAyahs = typeAyahMap.get(r.studentId) ?? new Map();
        const lessonTypes = [...entryTypeCounts.entries()].map(([type, count]) => {
          const ayahs = entryTypeAyahs.get(type) ?? 0;
          return {
            type: TYPE_TO_LEGACY[type as keyof typeof TYPE_TO_LEGACY] ?? type,
            total_ayahs: ayahs,
            ...toPagesLines(ayahs),
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
          ...toPagesLines(r.totalAyahs),
          total_entries: entryCountMap.get(r.studentId) ?? 0,
          lesson_types: lessonTypes,
          surahs_completed: surahsCompleted,
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
          limit,
          total_students_with_records: distinctStudents.length,
          students: topStudents,
        },
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
