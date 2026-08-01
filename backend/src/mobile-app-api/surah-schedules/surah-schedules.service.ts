import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetStudentScheduleQueryDto } from './dto/get-student-schedule-query.dto';

const include = {
  student: { select: { id: true, name: true } },
  surah: { select: { number: true, nameEnglish: true, nameArabic: true } },
  halqa: { select: { name: true } },
} satisfies Prisma.SurahHifdhStudentScheduleInclude;

type ScheduleRow = Prisma.SurahHifdhStudentScheduleGetPayload<{ include: typeof include }>;

function toLegacyEnumValue(value: string | null | undefined): string | null {
  return value ? value.toLowerCase() : null;
}

function toDisplay(value: string): string {
  const withSpaces = value.replace(/_/g, ' ');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'warning';
    case 'pending':
      return 'info';
    case 'needs_review':
      return 'danger';
    default:
      return 'secondary';
  }
}

// The legacy controller reads `$schedule->quality_assessment`, a column
// that has never existed on this table (the real column is
// `memorization_quality`, exposed under a different response key). Eloquent
// silently returns null for an undefined attribute, so this field — and its
// badge class, which derives from it — are always null / "secondary" /
// "Not assessed" in production. Replicated verbatim, not "fixed".
const QUALITY_ASSESSMENT_BADGE_CLASS = 'secondary';
const QUALITY_ASSESSMENT_DISPLAY = 'Not assessed';

function difficultyBadgeClass(difficulty: string): string {
  switch (difficulty) {
    case 'very_easy':
      return 'success';
    case 'easy':
      return 'info';
    case 'medium':
      return 'warning';
    case 'hard':
      return 'danger';
    case 'very_hard':
      return 'dark';
    default:
      return 'warning';
  }
}

@Injectable()
export class SurahSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireStudent(branchId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, branchId },
      include: {
        halqaMemberships: {
          where: { removedAt: null },
          include: { halqa: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    });
    if (!student) {
      throw new NotFoundException({ status: 'error', message: 'Student not found' });
    }
    return student;
  }

  private validateDateFilters(query: GetStudentScheduleQueryDto): void {
    const errors: string[] = [];
    if (query.year) {
      const year = Number(query.year);
      if (year < 1900 || year > 2100) errors.push('Year must be between 1900 and 2100');
    }
    if (query.month) {
      if (!query.year) errors.push('Year is required when month is specified');
      const month = Number(query.month);
      if (month < 1 || month > 12) errors.push('Month must be between 1 and 12');
    }
    if (errors.length > 0) {
      throw new BadRequestException({ status: 'error', message: 'Validation failed', errors });
    }
  }

  async getStudentSurahSchedule(branchId: string, studentId: string, query: GetStudentScheduleQueryDto) {
    this.validateDateFilters(query);
    const student = await this.requireStudent(branchId, studentId);
    const halqa = student.halqaMemberships[0]?.halqa ?? null;

    const latestScheduleNoAgg = await this.prisma.surahHifdhStudentSchedule.aggregate({
      where: { studentId },
      _max: { scheduleNo: true },
    });
    const latestScheduleNo = latestScheduleNoAgg._max.scheduleNo ?? null;

    const targetScheduleNo = query.schedule_no ? Number(query.schedule_no) : latestScheduleNo;

    const availableScheduleNumbers = (
      await this.prisma.surahHifdhStudentSchedule.findMany({
        where: { studentId },
        distinct: ['scheduleNo'],
        select: { scheduleNo: true },
        orderBy: { scheduleNo: 'desc' },
      })
    ).map((r) => r.scheduleNo);

    // Progress summary for the target schedule number.
    const summaryRows = targetScheduleNo
      ? await this.prisma.surahHifdhStudentSchedule.findMany({
          where: { studentId, scheduleNo: targetScheduleNo },
        })
      : [];
    const now = new Date();
    const todayStr = toDateOnly(now);
    const totalSchedules = summaryRows.length;
    const completedSchedules = summaryRows.filter((r) => r.status === 'COMPLETED').length;
    const inProgressSchedules = summaryRows.filter((r) => r.status === 'IN_PROGRESS').length;
    const pendingSchedules = summaryRows.filter((r) => r.status === 'PENDING').length;
    const needsReviewSchedules = summaryRows.filter((r) => r.status === 'NEEDS_REVIEW').length;
    const todayCount = summaryRows.filter(
      (r) => r.status !== 'COMPLETED' && toDateOnly(r.scheduledDate) === todayStr,
    ).length;
    const overdueCount = summaryRows.filter(
      (r) => r.status !== 'COMPLETED' && toDateOnly(r.scheduledDate) < todayStr,
    ).length;
    const upcomingCount = summaryRows.filter(
      (r) => r.status !== 'COMPLETED' && toDateOnly(r.scheduledDate) > todayStr,
    ).length;

    const progressSummary = {
      total_schedules: totalSchedules,
      completed_schedules: completedSchedules,
      in_progress_schedules: inProgressSchedules,
      pending_schedules: pendingSchedules,
      needs_review_schedules: needsReviewSchedules,
      today: todayCount,
      overdue: overdueCount,
      upcoming: upcomingCount,
      overall_percentage: totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 1000) / 10 : 0,
      schedule_no: targetScheduleNo,
    };

    // Per-surah progress for the target schedule number.
    let surahProgress: Record<string, unknown>[] = [];
    let currentSurah: Record<string, unknown> | null = null;
    if (targetScheduleNo) {
      const rowsWithSurah = await this.prisma.surahHifdhStudentSchedule.findMany({
        where: { studentId, scheduleNo: targetScheduleNo },
        include: { surah: { select: { number: true, nameEnglish: true, nameArabic: true } } },
      });

      const bySurah = new Map<number, typeof rowsWithSurah>();
      for (const row of rowsWithSurah) {
        const list = bySurah.get(row.surah.number) ?? [];
        list.push(row);
        bySurah.set(row.surah.number, list);
      }

      surahProgress = [...bySurah.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([surahNumber, rows]) => {
          const total = rows.length;
          const completed = rows.filter((r) => r.status === 'COMPLETED').length;
          const inProgress = rows.filter((r) => r.status === 'IN_PROGRESS').length;
          const pending = rows.filter((r) => r.status === 'PENDING').length;
          const needsReview = rows.filter((r) => r.status === 'NEEDS_REVIEW').length;
          const percentage = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
          return {
            surah_number: surahNumber,
            surah_name_en: rows[0].surah.nameEnglish,
            surah_name_ar: rows[0].surah.nameArabic,
            total,
            completed,
            in_progress: inProgress,
            pending,
            needs_review: needsReview,
            percentage,
            is_completed: completed === total,
          };
        });

      const current = surahProgress.find(
        (s) => (s.completed as number) > 0 && (s.completed as number) < (s.total as number),
      );
      if (current) {
        currentSurah = {
          number: current.surah_number,
          name_en: current.surah_name_en,
          name_ar: current.surah_name_ar,
          completed_entries: current.completed,
          total_entries: current.total,
          percentage: current.percentage,
        };
      }
    }

    const currentScheduleCompleted = latestScheduleNo
      ? totalIsFullyCompleted(
          await this.prisma.surahHifdhStudentSchedule.findMany({
            where: { studentId, scheduleNo: latestScheduleNo },
            select: { status: true },
          }),
        )
      : false;

    // Detailed, filtered, paginated schedule entries.
    const where: Prisma.SurahHifdhStudentScheduleWhereInput = { studentId };
    if (targetScheduleNo) where.scheduleNo = targetScheduleNo;

    const surahWhere: Prisma.SurahWhereInput = {};
    if (query.surah_number) surahWhere.number = Number(query.surah_number);
    if (query.search) {
      surahWhere.OR = [
        { nameEnglish: { contains: query.search, mode: 'insensitive' } },
        { nameArabic: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(surahWhere).length > 0) where.surah = surahWhere;

    if (query.status && query.status !== 'all') {
      if (query.status === 'overdue') {
        where.status = { not: 'COMPLETED' };
        where.scheduledDate = { lt: new Date(todayStr) };
      } else if (query.status === 'today') {
        where.status = { not: 'COMPLETED' };
        where.scheduledDate = new Date(todayStr);
      } else if (query.status === 'upcoming') {
        where.status = { not: 'COMPLETED' };
        where.scheduledDate = { gt: new Date(todayStr) };
      } else {
        where.status = query.status.toUpperCase() as never;
      }
    }

    if (query.date_from) {
      where.scheduledDate = { ...(where.scheduledDate as object), gte: new Date(query.date_from) };
    }
    if (query.date_to) {
      where.scheduledDate = { ...(where.scheduledDate as object), lte: new Date(query.date_to) };
    }

    if (query.year) {
      const year = Number(query.year);
      const month = query.month ? Number(query.month) : undefined;
      const start = month ? new Date(Date.UTC(year, month - 1, 1)) : new Date(Date.UTC(year, 0, 1));
      const end = month ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1));
      where.scheduledDate = { ...(where.scheduledDate as object), gte: start, lt: end };
    }

    const totalEntries = await this.prisma.surahHifdhStudentSchedule.count({ where });
    const page = query.page ? Number(query.page) : 1;
    const perPage = query.per_page ? Number(query.per_page) : Math.max(totalEntries, 1);
    const totalPages = perPage > 0 ? Math.ceil(totalEntries / perPage) : 1;
    const hasMorePages = page < totalPages;

    const scheduleEntries = await this.prisma.surahHifdhStudentSchedule.findMany({
      where,
      include,
      orderBy: [{ day: 'asc' }, { scheduledDate: 'asc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const schedulesData = scheduleEntries.map((schedule) => formatScheduleEntry(schedule, todayStr));

    return {
      status: 'success',
      data: {
        student: {
          id: student.id,
          name: student.name,
          halqa_name: halqa?.name ?? 'N/A',
          halqa_id: halqa?.id ?? null,
        },
        progress_summary: progressSummary,
        surah_progress: surahProgress,
        current_surah: currentSurah,
        current_schedule_completed: currentScheduleCompleted,
        available_schedule_numbers: availableScheduleNumbers,
        schedules: schedulesData,
        pagination: {
          total_entries: totalEntries,
          per_page: perPage,
          current_page: page,
          total_pages: totalPages,
          has_more_pages: hasMorePages,
        },
      },
    };
  }

  async getAvailableYearsMonths(branchId: string, studentId: string) {
    await this.requireStudent(branchId, studentId);

    const rows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: { studentId },
      select: { scheduledDate: true, status: true },
    });

    const byYearMonth = new Map<string, { year: number; month: number; total: number; completed: number }>();
    for (const row of rows) {
      const year = row.scheduledDate.getUTCFullYear();
      const month = row.scheduledDate.getUTCMonth() + 1;
      const key = `${year}-${month}`;
      const entry = byYearMonth.get(key) ?? { year, month, total: 0, completed: 0 };
      entry.total += 1;
      if (row.status === 'COMPLETED') entry.completed += 1;
      byYearMonth.set(key, entry);
    }

    const sorted = [...byYearMonth.values()].sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));

    const availableData: Array<{
      year: number;
      total_schedules: number;
      completed_schedules: number;
      months: Array<{ month: number; month_name: string; total_count: number; completed_count: number; completion_percentage: number }>;
      completion_percentage?: number;
    }> = [];

    let currentYear: number | null = null;
    for (const item of sorted) {
      if (currentYear !== item.year) {
        currentYear = item.year;
        availableData.push({ year: item.year, total_schedules: 0, completed_schedules: 0, months: [] });
      }
      const monthName = new Date(Date.UTC(item.year, item.month - 1, 1)).toLocaleString('en-US', {
        month: 'long',
        timeZone: 'UTC',
      });
      const completionPercentage = item.total > 0 ? Math.round((item.completed / item.total) * 1000) / 10 : 0;
      const yearEntry = availableData[availableData.length - 1];
      yearEntry.months.push({
        month: item.month,
        month_name: monthName,
        total_count: item.total,
        completed_count: item.completed,
        completion_percentage: completionPercentage,
      });
      yearEntry.total_schedules += item.total;
      yearEntry.completed_schedules += item.completed;
    }

    for (const yearData of availableData) {
      yearData.completion_percentage =
        yearData.total_schedules > 0 ? Math.round((yearData.completed_schedules / yearData.total_schedules) * 1000) / 10 : 0;
    }

    const totalSchedules = sorted.reduce((sum, i) => sum + i.total, 0);
    const totalCompleted = sorted.reduce((sum, i) => sum + i.completed, 0);

    return {
      status: 'success',
      data: {
        student_id: studentId,
        available_periods: availableData,
        summary: {
          total_years: availableData.length,
          earliest_year: sorted.length > 0 ? sorted[sorted.length - 1].year : null,
          latest_year: sorted.length > 0 ? sorted[0].year : null,
          total_schedules: totalSchedules,
          total_completed: totalCompleted,
        },
      },
    };
  }
}

function totalIsFullyCompleted(rows: { status: string }[]): boolean {
  return rows.length > 0 && rows.every((r) => r.status === 'COMPLETED');
}

function formatScheduleEntry(schedule: ScheduleRow, todayStr: string) {
  const status = toLegacyEnumValue(schedule.status)!;
  const difficulty = toLegacyEnumValue(schedule.difficultyLevel) ?? 'medium';
  const dateStr = toDateOnly(schedule.scheduledDate);

  return {
    id: schedule.id,
    day: schedule.day,
    date: dateStr,
    // No override-date concept in this schema (reschedule creates a new
    // row instead of mutating a `scheduled_date` column), so there is
    // never a separate "original vs rescheduled" pair to report here.
    scheduled_date: null,
    display_date: dateStr,
    surah_number: schedule.surah.number,
    surah_name_en: schedule.surah.nameEnglish,
    surah_name_ar: schedule.surah.nameArabic,
    juz_number: null, // legacy column never existed — always null in production
    page_from: schedule.pageNumberFrom,
    page_to: schedule.pageNumberTo,
    verse_from: schedule.fromAyah,
    verse_to: schedule.toAyah,
    schedule_type: schedule.scheduleType,
    completion_status: status,
    completion_status_display: toDisplay(status),
    completion_date: schedule.completionDate ? toDateOnly(schedule.completionDate) : null,
    quality_assessment: null, // legacy reads a nonexistent column — always null in production
    quality_assessment_display: QUALITY_ASSESSMENT_DISPLAY,
    difficulty_level: difficulty,
    difficulty_level_display: toDisplay(difficulty),
    notes: null, // legacy reads a nonexistent column — always null in production
    teacher_notes: schedule.teacherNotes,
    halqa_name: schedule.halqa?.name ?? 'N/A',
    schedule_no: schedule.scheduleNo,
    status_badge_class: statusBadgeClass(status),
    quality_badge_class: QUALITY_ASSESSMENT_BADGE_CLASS,
    difficulty_badge_class: difficultyBadgeClass(difficulty),
    is_overdue: status !== 'completed' && dateStr < todayStr,
    is_today: dateStr === todayStr,
    is_upcoming: status !== 'completed' && dateStr > todayStr,
  };
}
