import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { NotificationType, ProgressEntryGrade, ProgressEntryStatus, ProgressEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BulkMarkCompletedDto } from './dto/bulk-mark-completed.dto';
import { BulkMarkSurahsCompletedDto } from './dto/bulk-mark-surahs-completed.dto';
import { StoreOldLessonProgressDto } from './dto/store-old-lesson-progress.dto';
import { GetOldLessonProgressQueryDto } from './dto/get-old-lesson-progress-query.dto';
import { GetTodayProgressQueryDto } from './dto/get-today-progress-query.dto';
import { GetStudentsTargetQueryDto } from './dto/get-students-target-query.dto';
import { GetFullProgressReportQueryDto } from './dto/get-full-progress-report-query.dto';
import { GetTopStudentsQueryDto } from './dto/get-top-students-query.dto';
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
function fullName(user: { firstName: string; lastName: string | null } | null | undefined): string {
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

type EntryRow = Prisma.StudentSurahProgressEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>;

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
    remark_file_url: null, // no file-storage subsystem in this schema
    added_by: entry.addedBy ? { id: entry.addedById, name: fullName(entry.addedBy) } : null,
    last_updated_by: entry.lastUpdatedBy ? { id: entry.lastUpdatedById, name: fullName(entry.lastUpdatedBy) } : null,
    verified_by: entry.verifiedBy ? { id: entry.verifiedById, name: fullName(entry.verifiedBy) } : null,
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
  ) {}

  /** Notifies each affected student's linked login that their recitation/Hifdh progress was updated by a teacher. */
  private async notifyProgressMarked(branchId: string, updatedCountByStudentId: Map<string, number>) {
    if (updatedCountByStudentId.size === 0) {
      return;
    }
    const students = await this.prisma.student.findMany({
      where: { id: { in: [...updatedCountByStudentId.keys()] }, userId: { not: null } },
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
      throw new NotFoundException({ status: 'error', message: 'Student not found or inactive' });
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
  private async getScheduleOrderedSurahIds(studentId: string, fallbackSurahIds: string[]): Promise<string[]> {
    const scheduleRows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: { studentId, surahId: { not: null } },
      orderBy: [{ day: 'asc' }, { scheduledDate: 'asc' }],
      select: { surahId: true },
    });
    const orderedIds: string[] = [];
    for (const row of scheduleRows) {
      if (row.surahId && !orderedIds.includes(row.surahId)) orderedIds.push(row.surahId);
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

  private async formatStudentBasic(student: { id: string; name: string; user: { email: string | null } | null }) {
    return {
      id: student.id,
      name: student.name,
      email: student.user?.email ?? null,
      student_id: student.id,
      image_url: gravatarUrl(student.id),
    };
  }

  private async formatStudentWithHalqa(student: { id: string; name: string; user: { email: string | null } | null }) {
    const base = await this.formatStudentBasic(student);
    const halqa = await this.studentHalqa(student.id);
    return {
      ...base,
      halqa: halqa ? { id: halqa.id, name: halqa.name, status: halqa.status.toLowerCase() } : null,
    };
  }

  /** Legacy computes total/completed/verified/in_progress/not_started ayah COUNTS per surah — each row is "one ayah entry" in its model, replicated verbatim here (row-count, not ayah-range width). */
  private async getSurahStatistics(studentId: string, surahId: string) {
    const [total, completed, verified, inProgress, notStarted] = await Promise.all([
      this.prisma.studentSurahProgressEntry.count({ where: { studentId, surahId } }),
      this.prisma.studentSurahProgressEntry.count({ where: { studentId, surahId, status: 'COMPLETED' } }),
      this.prisma.studentSurahProgressEntry.count({ where: { studentId, surahId, status: 'VERIFIED' } }),
      this.prisma.studentSurahProgressEntry.count({ where: { studentId, surahId, status: 'IN_PROGRESS' } }),
      this.prisma.studentSurahProgressEntry.count({ where: { studentId, surahId, status: 'NOT_STARTED' } }),
    ]);
    const totalCompleted = completed + verified;
    const completionRate = total > 0 ? Math.round((totalCompleted / total) * 1000) / 10 : 0;
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
  async getSurahDetails(branchId: string, surahId: string, studentId: string, type?: string) {
    const student = await this.requireActiveStudent(branchId, studentId);
    const surah = await this.prisma.surah.findUnique({ where: { id: surahId }, select: SURAH_SELECT });
    if (!surah) {
      throw new NotFoundException({ status: 'error', message: 'Surah not found' });
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
    const groupedProgress: { completed_at: string | null; entries: unknown[] }[] = sortedDates.map((date) => ({
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
  async getSurahProgressList(branchId: string, studentId: string, type?: string) {
    const student = await this.requireActiveStudent(branchId, studentId);

    const allRecords = await this.prisma.studentSurahProgressEntry.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
      select: { surahId: true },
    });
    const fallbackSurahIds: string[] = [];
    for (const r of allRecords) {
      if (r.surahId && !fallbackSurahIds.includes(r.surahId)) fallbackSurahIds.push(r.surahId);
    }
    const orderedSurahIds = await this.getScheduleOrderedSurahIds(studentId, fallbackSurahIds);

    const surahs = await this.prisma.surah.findMany({ where: { id: { in: orderedSurahIds } }, select: SURAH_SELECT });
    const surahById = new Map(surahs.map((s) => [s.id, s]));
    const orderedSurahs = orderedSurahIds.map((id) => surahById.get(id)).filter((s): s is NonNullable<typeof s> => !!s);

    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: { studentId, ...this.typeWhere(type) },
    });

    const progressMap = new Map<
      string,
      { total: number; completed: number; inProgress: number; notStarted: number; types: Set<string> }
    >();
    for (const e of entries) {
      if (!e.surahId) continue;
      const entry = progressMap.get(e.surahId) ?? {
        total: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        types: new Set<string>(),
      };
      entry.total += 1;
      if (e.type) entry.types.add(TYPE_TO_LEGACY[e.type]);
      if (e.status === 'COMPLETED' || e.status === 'VERIFIED') entry.completed += 1;
      else if (e.status === 'IN_PROGRESS') entry.inProgress += 1;
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
          progressPercentage = data.total > 0 ? Math.round((data.completed / data.total) * 10000) / 100 : 0;
        }
      }
      const displayType = type ?? (types.length > 0 ? types.join(', ') : 'No lessons');

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
    const completedSurahs = surahList.filter((s) => s.completion_status === 'Completed').length;
    const inProgressSurahs = surahList.filter((s) => s.completion_status === 'In Progress').length;
    const notStartedSurahs = surahList.filter((s) => s.completion_status === 'Not Started').length;
    const overallProgress = totalSurahs > 0 ? Math.round((completedSurahs / totalSurahs) * 10000) / 100 : 0;

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
        },
        filter_applied: { type: type ?? null },
      },
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
      if (r.surahId && !fallbackIds.includes(r.surahId)) fallbackIds.push(r.surahId);
    }
    return this.getScheduleOrderedSurahIds(studentId, fallbackIds);
  }

  private async determineTargetSurah(studentId: string, requestedSurahId?: string): Promise<string | null> {
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
    const current = await this.prisma.surah.findUnique({ where: { id: currentSurahId }, select: { number: true } });
    if (!current) return null;
    if (current.number === 1) {
      return this.prisma.surah.findFirst({ where: { number: 114 }, select: SURAH_SELECT });
    }
    return this.prisma.surah.findFirst({
      where: { number: { lt: current.number } },
      orderBy: { number: 'desc' },
      select: SURAH_SELECT,
    });
  }

  private async getLogicExplanation(studentId: string, requestedSurahId?: string) {
    if (requestedSurahId) {
      return { determined_by: 'requested_surah_id', description: 'Surah was explicitly requested via surah_id parameter' };
    }
    const lastCompleted = await this.prisma.studentSurahProgressEntry.findFirst({
      where: { studentId, status: { in: ['COMPLETED', 'VERIFIED'] } },
      orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!lastCompleted || !lastCompleted.surahId) {
      return { determined_by: 'first_available_surah', description: 'No completed ayahs found, returned first Surah with any progress' };
    }
    const [total, completedCount] = await Promise.all([
      this.prisma.studentSurahProgressEntry.count({ where: { studentId, surahId: lastCompleted.surahId } }),
      this.prisma.studentSurahProgressEntry.count({
        where: { studentId, surahId: lastCompleted.surahId, status: { in: ['COMPLETED', 'VERIFIED'] } },
      }),
    ]);
    if (total > 0 && completedCount >= total) {
      return { determined_by: 'next_surah_logic', description: 'All ayahs of the last completed Surah are finished, returned next Surah in sequence' };
    }
    return { determined_by: 'last_completed_surah', description: 'Returned the Surah containing the most recently completed ayah' };
  }

  // ── getStudentSurahProgress ─────────────────────────────────────────
  async getStudentSurahProgress(branchId: string, studentId: string, query: GetStudentSurahProgressQueryDto) {
    const student = await this.requireActiveStudent(branchId, studentId);

    const targetSurahId = await this.determineTargetSurah(studentId, query.surah_id);
    if (!targetSurahId) {
      throw new NotFoundException({ status: 'error', message: 'No Surah progress found for this student' });
    }
    const targetSurah = await this.prisma.surah.findUnique({ where: { id: targetSurahId }, select: SURAH_SELECT });
    if (!targetSurah) {
      throw new NotFoundException({ status: 'error', message: 'Target Surah not found' });
    }

    const surahStats = await this.getSurahStatistics(studentId, targetSurahId);

    let nextSurahData: { id: string; surah_number: number; name_ar: string; name_en: string; total_ayahs: number } | null = null;
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
      where: { studentId, surahId: targetSurahId, ...this.typeWhere(query.type) },
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
        logic_applied: await this.getLogicExplanation(studentId, query.surah_id),
      },
    };
  }

  // ── bulkMarkCompleted ────────────────────────────────────────────────
  async bulkMarkCompleted(branchId: string, userId: string, dto: BulkMarkCompletedDto) {
    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: { id: { in: dto.ayah_ids }, branchId },
    });
    if (entries.length === 0) {
      throw new NotFoundException({ status: 'error', message: 'No valid ayah progress records found' });
    }

    const completedAt = dto.completed_at ? new Date(dto.completed_at) : new Date();
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const updatedCountByStudentId = new Map<string, number>();

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
              lastUpdatedById: userId,
            },
          });
          updatedCount += 1;
          updatedCountByStudentId.set(entry.studentId, (updatedCountByStudentId.get(entry.studentId) ?? 0) + 1);
        } else {
          skippedCount += 1;
          errors.push(`Ayah ${entry.fromAyah} is already ${STATUS_TO_LEGACY[entry.status]}`);
        }
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
        file_uploaded: false,
        file_name: null,
        errors,
      },
    };
  }

  // ── getPendingSurahList ──────────────────────────────────────────────
  async getPendingSurahList(branchId: string, studentId: string, type?: string) {
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
      if (e.surahId && !fallbackSurahIds.includes(e.surahId)) fallbackSurahIds.push(e.surahId);
    }
    const orderedSurahIds = await this.getScheduleOrderedSurahIds(studentId, fallbackSurahIds);
    const rank = new Map(orderedSurahIds.map((id, i) => [id, i]));
    const sortedEntries = [...entries].sort(
      (a, b) => (rank.get(a.surahId ?? '') ?? Infinity) - (rank.get(b.surahId ?? '') ?? Infinity),
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
  async bulkMarkSurahsAsCompleted(branchId: string, userId: string, dto: BulkMarkSurahsCompletedDto) {
    await this.requireActiveStudent(branchId, dto.student_id);

    const surahs = await this.prisma.surah.findMany({ where: { id: { in: dto.surah_ids } } });
    const surahById = new Map(surahs.map((s) => [s.id, s]));

    const pending = await this.prisma.studentSurahProgressEntry.findMany({
      where: {
        studentId: dto.student_id,
        surahId: { in: dto.surah_ids },
        status: { notIn: ['COMPLETED', 'VERIFIED'] },
        ...(dto.type && { type: TYPE_TO_ENUM[dto.type] }),
      },
    });
    if (pending.length === 0) {
      throw new NotFoundException({ status: 'error', message: 'No pending progress entries found for the specified surahs' });
    }

    const completedAt = dto.completed_at ? new Date(dto.completed_at) : new Date();
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
          },
        });
        if (entry.surahId) entriesBySurah.set(entry.surahId, (entriesBySurah.get(entry.surahId) ?? 0) + 1);
      }
    });

    await this.notifyProgressMarked(branchId, new Map([[dto.student_id, pending.length]]));

    const surahSummary = dto.surah_ids
      .map((surahId) => {
        const surah = surahById.get(surahId);
        if (!surah) return null;
        return { surah_id: surah.id, surah_name: surah.nameEnglish, completed_entries: entriesBySurah.get(surahId) ?? 0 };
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
  async getCompletedSurahList(branchId: string, studentId: string, type = 'New Lesson') {
    const student = await this.requireActiveStudent(branchId, studentId);

    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: { studentId, status: { not: 'NOT_STARTED' }, ...this.typeWhere(type) },
      include: { surah: { select: SURAH_SELECT } },
    });

    const bySurah = new Map<
      string,
      { surah: NonNullable<(typeof entries)[number]['surah']>; total: number; completed: number; latestCompletedAt: Date | null }
    >();
    for (const e of entries) {
      if (!e.surah) continue;
      const data = bySurah.get(e.surahId!) ?? { surah: e.surah, total: 0, completed: 0, latestCompletedAt: null };
      data.total += 1;
      if (e.status === 'COMPLETED' || e.status === 'VERIFIED') {
        data.completed += 1;
        if (e.completedAt && (!data.latestCompletedAt || e.completedAt > data.latestCompletedAt)) {
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
      const status = data.completed === data.total && data.total > 0 && data.total === data.surah.totalAyahs ? 'completed' : 'partially completed';
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
        progress_percentage: data.total > 0 ? Math.round((data.completed / data.total) * 10000) / 100 : 0,
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
          fully_completed_surahs: completedSurahs.filter((s) => s.status === 'completed').length,
          partially_completed_surahs: completedSurahs.filter((s) => s.status === 'partially completed').length,
          total_ayahs_completed_overall: totalCompletedOverall,
          total_ayahs_covered_overall: totalOverall,
        },
        filter_applied: { type },
      },
    };
  }

  // ── storeOldLessonProgress ───────────────────────────────────────────
  async storeOldLessonProgress(branchId: string, userId: string, dto: StoreOldLessonProgressDto) {
    await this.requireActiveStudent(branchId, dto.student_id);

    let surahId: string | undefined;
    let fromAyah: number | undefined;
    let toAyah: number | undefined;

    if (dto.surah_from) {
      const surahFrom = await this.prisma.surah.findUnique({ where: { number: dto.surah_from } });
      if (surahFrom) {
        surahId = surahFrom.id;
        fromAyah = dto.surah_from_ayah ?? 1;
      }
    }
    if (dto.surah_to) {
      const surahTo = await this.prisma.surah.findUnique({ where: { number: dto.surah_to } });
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
        remark_file_url: null,
        surah_from: entry.surahFrom,
        surah_from_ayah: entry.surahFromAyah,
        surah_to: entry.surahTo,
        surah_to_ayah: entry.surahToAyah,
        juzuh_from: entry.juzuhFrom,
        juzuh_to: entry.juzuhTo,
        page_from: entry.pageFrom,
        page_to: entry.pageTo,
        surah_range: entry.surahFrom ? `${entry.surahFrom}${entry.surahTo && entry.surahTo !== entry.surahFrom ? `-${entry.surahTo}` : ''}` : null,
        juzuh_range: entry.juzuhFrom ? `${entry.juzuhFrom}${entry.juzuhTo && entry.juzuhTo !== entry.juzuhFrom ? `-${entry.juzuhTo}` : ''}` : null,
        page_range: entry.pageFrom ? `${entry.pageFrom}${entry.pageTo && entry.pageTo !== entry.pageFrom ? `-${entry.pageTo}` : ''}` : null,
        created_at: formatDateTime(entry.createdAt),
      },
    };
  }

  // ── getOldLessonProgressList ─────────────────────────────────────────
  async getOldLessonProgressList(branchId: string, studentId: string, query: GetOldLessonProgressQueryDto) {
    const student = await this.requireActiveStudent(branchId, studentId);

    const where: Prisma.StudentSurahProgressEntryWhereInput = {
      studentId,
      type: TYPE_TO_ENUM[query.type],
    };
    if (query.completed_at_from || query.completed_at_to) {
      where.completedAt = {
        ...(query.completed_at_from && { gte: new Date(`${query.completed_at_from}T00:00:00.000Z`) }),
        ...(query.completed_at_to && { lte: new Date(`${query.completed_at_to}T23:59:59.999Z`) }),
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
      this.prisma.studentSurahProgressEntry.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.studentSurahProgressEntry.count({ where: { ...where, status: 'VERIFIED' } }),
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

    const progressData = entries.map((entry) => ({
      ...serializeEntry(entry),
      surah_from: entry.surahFrom,
      surah_from_ayah: entry.surahFromAyah,
      surah_to: entry.surahTo,
      surah_to_ayah: entry.surahToAyah,
      surah_range: entry.surahFrom ? `${entry.surahFrom}${entry.surahTo && entry.surahTo !== entry.surahFrom ? `-${entry.surahTo}` : ''}` : null,
      juzuh_from: entry.juzuhFrom,
      juzuh_to: entry.juzuhTo,
      juzuh_range: entry.juzuhFrom ? `${entry.juzuhFrom}${entry.juzuhTo && entry.juzuhTo !== entry.juzuhFrom ? `-${entry.juzuhTo}` : ''}` : null,
      page_from: entry.pageFrom,
      page_to: entry.pageTo,
      page_range: entry.pageFrom ? `${entry.pageFrom}${entry.pageTo && entry.pageTo !== entry.pageFrom ? `-${entry.pageTo}` : ''}` : null,
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
        statistics: { total_records: total, completed_records: completedCount, verified_records: verifiedCount },
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

  private async activeStudentsForReport(branchId: string, halqaId?: string, studentId?: string) {
    return this.prisma.student.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
        ...(halqaId && { halqaMemberships: { some: { halqaId, removedAt: null } } }),
        ...(studentId && { id: studentId }),
      },
      include: { user: { select: { email: true } } },
    });
  }

  // ── getTodayProgress ─────────────────────────────────────────────────
  async getTodayProgress(branchId: string, query: GetTodayProgressQueryDto) {
    const fromDate = query.from_date ?? formatDateOnly(new Date())!;
    const toDate = query.to_date ?? fromDate;
    const range = { gte: new Date(`${fromDate}T00:00:00.000Z`), lte: new Date(`${toDate}T23:59:59.999Z`) };

    const students = await this.activeStudentsForReport(branchId, query.halqa_id, query.student_id);
    const studentIds = students.map((s) => s.id);

    const completedRecords = await this.prisma.studentSurahProgressEntry.findMany({
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

    const [leaves, exams, holidays] = await Promise.all([
      this.prisma.studentLeave.findMany({
        where: { studentId: { in: studentIds }, status: 'APPROVED', leaveDate: { gte: new Date(fromDate), lte: new Date(toDate) } },
      }),
      this.prisma.studentExam.findMany({
        where: { studentId: { in: studentIds }, examDate: { gte: new Date(fromDate), lte: new Date(toDate) } },
      }),
      this.prisma.calendarDay.findMany({
        where: { branchId, isHoliday: true, date: { gte: new Date(fromDate), lte: new Date(toDate) } },
        orderBy: { date: 'asc' },
      }),
    ]);
    const leavesByStudent = new Map<string, typeof leaves>();
    for (const l of leaves) leavesByStudent.set(l.studentId, [...(leavesByStudent.get(l.studentId) ?? []), l]);
    const examsByStudent = new Map<string, typeof exams>();
    for (const e of exams) examsByStudent.set(e.studentId, [...(examsByStudent.get(e.studentId) ?? []), e]);

    const completedStudents: Record<string, unknown>[] = [];
    const pendingStudents: Record<string, unknown>[] = [];

    for (const student of students) {
      const records = progressByStudent.get(student.id);
      const activities: Record<string, unknown>[] = [];
      const lessonTypesMap = new Map<string, { type: string; total_ayahs: number; entries_count: number }>();
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
            details: { surah_id: r.surahId, from_ayah: r.fromAyah, to_ayah: r.toAyah, grade: r.grade ? GRADE_TO_LEGACY[r.grade] : null },
          });
          const key = typeLabel;
          const entry = lessonTypesMap.get(key) ?? { type: typeLabel, total_ayahs: 0, entries_count: 0 };
          entry.total_ayahs += ayahs;
          entry.entries_count += 1;
          lessonTypesMap.set(key, entry);
          if (r.surah && !surahsCompleted.some((s) => (s as { id: string }).id === r.surah!.id)) {
            surahsCompleted.push(serializeSurahBasic(r.surah));
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
      activities.sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')));

      const studentData: Record<string, unknown> = {
        student: await this.formatStudentBasic(student),
        activities,
        total_ayahs_today: totalAyahsToday,
        lesson_types: [...lessonTypesMap.values()],
        surahs_completed: surahsCompleted,
      };

      if (records && records.length > 0) completedStudents.push(studentData);
      else pendingStudents.push(studentData);
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
        filters: { from_date: fromDate, to_date: toDate, halqa_id: query.halqa_id ?? null, student_id: query.student_id ?? null, type: query.type ?? null },
        completed: { total_students: completedStudents.length, students: completedStudents },
        pending: { total_students: pendingStudents.length, students: pendingStudents },
        global_events: globalEvents,
      },
    };
  }

  private async targetAndActualAyahs(branchId: string, studentId: string, fromDate: string, toDate: string, type?: string) {
    const range = { gte: new Date(`${fromDate}T00:00:00.000Z`), lte: new Date(`${toDate}T23:59:59.999Z`) };
    const schedules = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: { studentId, scheduledDate: { gte: new Date(fromDate), lte: new Date(toDate) } },
    });
    const targetAyahs = schedules.reduce((sum, s) => sum + this.ayahSpan(s.fromAyah, s.toAyah), 0);

    const records = await this.prisma.studentSurahProgressEntry.findMany({
      where: {
        branchId,
        studentId,
        status: { in: ['COMPLETED', 'VERIFIED'] },
        completedAt: range,
        ...(type && { type: TYPE_TO_ENUM[type] }),
      },
    });
    const actualAyahs = records.reduce((sum, r) => sum + this.ayahSpan(r.fromAyah, r.toAyah), 0);

    return { targetAyahs, actualAyahs };
  }

  // ── studentsWithPendingTargets ───────────────────────────────────────
  async studentsWithPendingTargets(branchId: string, query: GetStudentsTargetQueryDto) {
    if (!query.from_date || !query.to_date) {
      throw new BadRequestException({ status: 'error', message: 'from_date and to_date are required' });
    }
    const minDeficit = query.min_deficit ? Number(query.min_deficit) : 0;
    const limit = query.limit ? Number(query.limit) : 20;

    const students = await this.activeStudentsForReport(branchId, query.halqa_id);
    const result: Record<string, unknown>[] = [];

    for (const student of students) {
      const { targetAyahs, actualAyahs } = await this.targetAndActualAyahs(
        branchId,
        student.id,
        query.from_date,
        query.to_date,
        query.type,
      );
      if (targetAyahs === 0) continue;
      const deficit = targetAyahs - actualAyahs;
      if (deficit > minDeficit) {
        const halqa = await this.studentHalqa(student.id);
        result.push({
          student: { ...(await this.formatStudentBasic(student)), halqa: halqa ? { id: halqa.id, name: halqa.name } : null },
          target_ayahs: targetAyahs,
          actual_ayahs: actualAyahs,
          deficit_ayahs: deficit,
        });
      }
    }

    result.sort((a, b) => (b as { deficit_ayahs: number }).deficit_ayahs - (a as { deficit_ayahs: number }).deficit_ayahs);
    const limited = result.slice(0, limit);

    return {
      status: 'success',
      data: {
        period: { from_date: query.from_date, to_date: query.to_date },
        filters: { halqa_id: query.halqa_id ?? null, type: query.type ?? null, min_deficit: minDeficit, limit },
        total_students_with_pending: limited.length,
        students: limited,
      },
    };
  }

  // ── getStudentsExceededTarget ────────────────────────────────────────
  async getStudentsExceededTarget(branchId: string, query: GetStudentsTargetQueryDto) {
    const now = new Date();
    const fromDate = query.from_date ?? formatDateOnly(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))!;
    const toDate = query.to_date ?? formatDateOnly(now)!;
    const minExcess = query.min_excess ? Number(query.min_excess) : 0;
    const limit = query.limit ? Number(query.limit) : 20;

    const students = await this.activeStudentsForReport(branchId, query.halqa_id);
    const result: Record<string, unknown>[] = [];

    for (const student of students) {
      const { targetAyahs, actualAyahs } = await this.targetAndActualAyahs(branchId, student.id, fromDate, toDate, query.type);
      const excess = actualAyahs - targetAyahs;
      if (excess > minExcess) {
        const halqa = await this.studentHalqa(student.id);
        result.push({
          student: { ...(await this.formatStudentBasic(student)), halqa: halqa ? { id: halqa.id, name: halqa.name } : null },
          target_ayahs: targetAyahs,
          actual_ayahs: actualAyahs,
          excess_ayahs: excess,
        });
      }
    }

    result.sort((a, b) => (b as { excess_ayahs: number }).excess_ayahs - (a as { excess_ayahs: number }).excess_ayahs);
    const limited = result.slice(0, limit);

    return {
      status: 'success',
      data: {
        period: { from_date: fromDate, to_date: toDate },
        filters: { halqa_id: query.halqa_id ?? null, type: query.type ?? null, min_excess: minExcess, limit },
        total_students_exceeded: limited.length,
        students: limited,
      },
    };
  }

  // ── getFullProgressReport ────────────────────────────────────────────
  async getFullProgressReport(branchId: string, query: GetFullProgressReportQueryDto) {
    const { from_date: fromDate, to_date: toDate } = query;
    const types = query.types ?? [];
    const rangeLength = Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1;
    const recentFrom = formatDateOnly(new Date(Date.now() - rangeLength * 86400000))!;
    const recentTo = formatDateOnly(new Date())!;

    const students = await this.activeStudentsForReport(branchId, query.halqa_id, query.student_id);

    const getStudentsWithAllTypes = async (start: string, end: string): Promise<string[] | null> => {
      if (types.length === 0) return null;
      const grouped = await this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId'],
        where: {
          branchId,
          status: { in: ['COMPLETED', 'VERIFIED'] },
          completedAt: { gte: new Date(`${start}T00:00:00.000Z`), lte: new Date(`${end}T23:59:59.999Z`) },
          type: { in: types.map((t) => TYPE_TO_ENUM[t]) },
        },
        _count: { _all: true },
      });
      // groupBy doesn't give distinct-type counts directly; approximate by re-querying distinct types per student.
      const result: string[] = [];
      for (const g of grouped) {
        const distinctTypes = await this.prisma.studentSurahProgressEntry.findMany({
          where: {
            branchId,
            studentId: g.studentId,
            status: { in: ['COMPLETED', 'VERIFIED'] },
            completedAt: { gte: new Date(`${start}T00:00:00.000Z`), lte: new Date(`${end}T23:59:59.999Z`) },
            type: { in: types.map((t) => TYPE_TO_ENUM[t]) },
          },
          distinct: ['type'],
          select: { type: true },
        });
        if (distinctTypes.length >= types.length) result.push(g.studentId);
      }
      return result;
    };

    const studentsWithAllTypesInRange = await getStudentsWithAllTypes(fromDate, toDate);
    const studentsWithAllTypesRecent = await getStudentsWithAllTypes(recentFrom, recentTo);
    const hasAllTypesRecent = new Set(studentsWithAllTypesRecent ?? []);
    const isInactiveRecent = (studentId: string) => !hasAllTypesRecent.has(studentId);

    const completedWhere: Prisma.StudentSurahProgressEntryWhereInput = {
      branchId,
      status: { in: ['COMPLETED', 'VERIFIED'] },
      completedAt: { gte: new Date(`${fromDate}T00:00:00.000Z`), lte: new Date(`${toDate}T23:59:59.999Z`) },
      ...(query.student_id && { studentId: query.student_id }),
    };
    if (types.length > 0) {
      completedWhere.type = { in: types.map((t) => TYPE_TO_ENUM[t]) };
      completedWhere.studentId =
        studentsWithAllTypesInRange && studentsWithAllTypesInRange.length > 0
          ? { in: studentsWithAllTypesInRange }
          : '__none__';
    }
    if (query.halqa_id) {
      const memberIds = (
        await this.prisma.halqaStudent.findMany({ where: { halqaId: query.halqa_id, removedAt: null }, select: { studentId: true } })
      ).map((m) => m.studentId);
      completedWhere.studentId = completedWhere.studentId ? completedWhere.studentId : { in: memberIds };
    }

    const completedRecords = await this.prisma.studentSurahProgressEntry.findMany({
      where: completedWhere,
      include: { surah: { select: SURAH_SELECT } },
    });

    const studentsCompletedMap = new Map<string, Record<string, unknown>>();
    let totalAyahs = 0;
    const studentBasicCache = new Map<string, Record<string, unknown>>();
    const getBasic = async (studentId: string) => {
      if (studentBasicCache.has(studentId)) return studentBasicCache.get(studentId)!;
      const student = students.find((s) => s.id === studentId) ?? (await this.prisma.student.findUnique({ where: { id: studentId }, include: { user: { select: { email: true } } } }));
      const basic = student ? await this.formatStudentBasic(student) : { id: studentId };
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
          lesson_types: new Map<string, { type: string; total_ayahs: number; entries_count: number }>(),
          total_ayahs_today: 0,
          surahs_completed: [] as Record<string, unknown>[],
        });
      }
      const entry = studentsCompletedMap.get(sid)!;
      entry.total_ayahs_today = (entry.total_ayahs_today as number) + ayahs;
      const lessonTypes = entry.lesson_types as Map<string, { type: string; total_ayahs: number; entries_count: number }>;
      const typeLabel = record.type ? TYPE_TO_LEGACY[record.type] : 'Lesson';
      const lt = lessonTypes.get(typeLabel) ?? { type: typeLabel, total_ayahs: 0, entries_count: 0 };
      lt.total_ayahs += ayahs;
      lt.entries_count += 1;
      lessonTypes.set(typeLabel, lt);
      const surahsCompleted = entry.surahs_completed as Record<string, unknown>[];
      if (record.surah && !surahsCompleted.some((s) => (s as { id: string }).id === record.surah!.id)) {
        surahsCompleted.push(serializeSurahBasic(record.surah));
      }
    }

    const completedList = [...studentsCompletedMap.values()].map((entry) => ({
      ...entry,
      lesson_types: [...(entry.lesson_types as Map<string, unknown>).values()],
    }));

    const pendingList: Record<string, unknown>[] = [];
    const studentsWithAllTypesSet = new Set(types.length > 0 ? studentsWithAllTypesInRange ?? [] : []);
    for (const student of students) {
      let hasAllRequired: boolean;
      if (types.length === 0) {
        hasAllRequired = await this.prisma.studentSurahProgressEntry
          .count({
            where: {
              branchId,
              studentId: student.id,
              status: { in: ['COMPLETED', 'VERIFIED'] },
              completedAt: { gte: new Date(`${fromDate}T00:00:00.000Z`), lte: new Date(`${toDate}T23:59:59.999Z`) },
            },
          })
          .then((c) => c > 0);
      } else {
        hasAllRequired = studentsWithAllTypesSet.has(student.id);
      }
      if (!hasAllRequired) {
        pendingList.push({ student: await getBasic(student.id), is_inactive_recent: isInactiveRecent(student.id) });
      }
    }

    return {
      status: 'success',
      data: {
        date_range: { from_date: fromDate, to_date: toDate },
        inactive_lookback_days: rangeLength,
        filters: { halqa_id: query.halqa_id ?? null, student_id: query.student_id ?? null, types },
        completed: { total_students: completedList.length, total_ayahs_marked: totalAyahs, students: completedList },
        pending: { total_students: pendingList.length, students: pendingList },
      },
    };
  }

  // ── getTopStudents ───────────────────────────────────────────────────
  async getTopStudents(branchId: string, query: GetTopStudentsQueryDto) {
    const types = query.types ?? [];
    const limit = query.limit ? Number(query.limit) : 10;

    const where: Prisma.StudentSurahProgressEntryWhereInput = {
      branchId,
      status: { in: ['COMPLETED', 'VERIFIED'] },
      completedAt: { gte: new Date(`${query.from_date}T00:00:00.000Z`), lte: new Date(`${query.to_date}T23:59:59.999Z`) },
      ...(query.student_id && { studentId: query.student_id }),
      ...(types.length > 0 && { type: { in: types.map((t) => TYPE_TO_ENUM[t]) } }),
    };
    if (query.halqa_id) {
      const memberIds = (
        await this.prisma.halqaStudent.findMany({ where: { halqaId: query.halqa_id, removedAt: null }, select: { studentId: true } })
      ).map((m) => m.studentId);
      where.studentId = query.student_id ? query.student_id : { in: memberIds };
    }

    const records = await this.prisma.studentSurahProgressEntry.findMany({
      where,
      include: { student: { include: { user: { select: { email: true } } } }, surah: { select: SURAH_SELECT } },
    });

    const studentsData = new Map<
      string,
      {
        student: Record<string, unknown>;
        total_ayahs: number;
        total_entries: number;
        lesson_types: Map<string, { type: string; total_ayahs: number; entries_count: number }>;
        surahs_completed: Record<string, unknown>[];
      }
    >();

    for (const r of records) {
      const sid = r.studentId;
      const ayahs = this.ayahSpan(r.fromAyah, r.toAyah);
      if (!studentsData.has(sid)) {
        studentsData.set(sid, {
          student: await this.formatStudentBasic(r.student),
          total_ayahs: 0,
          total_entries: 0,
          lesson_types: new Map(),
          surahs_completed: [],
        });
      }
      const data = studentsData.get(sid)!;
      data.total_ayahs += ayahs;
      data.total_entries += 1;
      const typeLabel = r.type ? TYPE_TO_LEGACY[r.type] : 'Lesson';
      const lt = data.lesson_types.get(typeLabel) ?? { type: typeLabel, total_ayahs: 0, entries_count: 0 };
      lt.total_ayahs += ayahs;
      lt.entries_count += 1;
      data.lesson_types.set(typeLabel, lt);
      if (r.surah && !data.surahs_completed.some((s) => (s as { id: string }).id === r.surah!.id)) {
        data.surahs_completed.push(serializeSurahBasic(r.surah));
      }
    }

    const list = [...studentsData.values()]
      .map((d) => ({ ...d, lesson_types: [...d.lesson_types.values()] }))
      .sort((a, b) => b.total_ayahs - a.total_ayahs);
    const topStudents = list.slice(0, limit);

    return {
      status: 'success',
      data: {
        date_range: { from_date: query.from_date, to_date: query.to_date },
        filters: { halqa_id: query.halqa_id ?? null, student_id: query.student_id ?? null, types },
        top_students: { limit, total_students_with_records: list.length, students: topStudents },
      },
    };
  }

  // ── updateProgress ───────────────────────────────────────────────────
  async updateProgress(branchId: string, userId: string, dto: UpdateProgressDto) {
    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: { id: { in: dto.progress_ids }, branchId },
    });
    if (entries.length === 0) {
      throw new NotFoundException({ status: 'error', message: 'No valid progress records found' });
    }

    let updatedCount = 0;
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
          }
          continue;
        }

        await tx.studentSurahProgressEntry.update({
          where: { id: entry.id },
          data: {
            ...(dto.grade !== undefined && { grade: GRADE_TO_ENUM[dto.grade] }),
            ...(dto.remarks !== undefined && { remarks: dto.remarks }),
            ...(dto.completed_at && { completedAt: new Date(dto.completed_at) }),
            lastUpdatedById: userId,
          },
        });
        updatedCount += 1;
      }
    });

    return {
      status: 'success',
      message: dto.unmark ? 'Ayahs unmarked successfully' : 'Progress updated successfully',
      data: { updated_count: updatedCount, progress_ids: dto.progress_ids },
    };
  }
}

function serializeSurahBasic(surah: { id: string; number: number; nameArabic: string; nameEnglish: string; totalAyahs?: number }) {
  return {
    id: surah.id,
    surah_number: surah.number,
    name_ar: surah.nameArabic,
    name_en: surah.nameEnglish,
    ...(surah.totalAyahs !== undefined && { total_ayahs: surah.totalAyahs }),
  };
}
