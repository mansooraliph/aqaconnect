import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateSchedulesDto } from './dto/generate-schedules.dto';
import { RescheduleDto } from './dto/reschedule.dto';

@Injectable()
export class HifdhService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves the caller's own Teacher.id from their userId, if they have a Teacher profile. */
  async resolveOwnTeacherId(userId: string): Promise<string | undefined> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    return teacher?.id;
  }

  /** Same as above, but throws if the caller has no Teacher profile — for verify actions that require one. */
  async requireOwnTeacherId(userId: string): Promise<string> {
    const teacherId = await this.resolveOwnTeacherId(userId);
    if (!teacherId) {
      throw new BadRequestException('Only a teacher account can verify progress');
    }
    return teacherId;
  }

  // ── Schedules ──────────────────────────────────────────────────────────

  listSchedules(studentId?: string, surahId?: string, status?: string) {
    return this.prisma.surahHifdhStudentSchedule.findMany({
      where: {
        ...(studentId && { studentId }),
        ...(surahId && { surahId }),
        ...(status && { status: status as never }),
      },
      include: {
        student: { select: { id: true, name: true, studentCode: true } },
        surah: { select: { number: true, nameEnglish: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        rescheduledFrom: true,
        rescheduledTo: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  private async findScheduleOrThrow(id: string) {
    const schedule = await this.prisma.surahHifdhStudentSchedule.findUnique({ where: { id } });
    if (!schedule) {
      throw new NotFoundException('Hifdh schedule not found');
    }
    return schedule;
  }

  /**
   * Generates one schedule row per (student x day-row) from the single
   * master SurahTargetSchedule — idempotent per (studentId, surahId,
   * scheduledDate): re-running with the same startDate skips days that
   * already have a schedule for that student, rather than duplicating. Rows
   * may each reference a different surah (same as the legacy per-row
   * surah_number), so surahId/fromAyah/toAyah come from each row, not a
   * single shared template. Milestone rows with no surah portion (e.g.
   * "Preparation day", "Exam Juz 30") are skipped — they have nothing to
   * generate a memorization schedule row from.
   */
  async generateSchedules(branchId: string, teacherId: string | undefined, dto: GenerateSchedulesDto) {
    const allRows = await this.prisma.surahTargetSchedule.findMany({
      orderBy: { dayNumber: 'asc' },
    });
    const targets = allRows.filter(
      (r): r is typeof r & { surahId: string; fromAyah: number; toAyah: number } =>
        r.surahId !== null && r.fromAyah !== null && r.toAyah !== null,
    );
    if (targets.length === 0) {
      throw new BadRequestException('The target schedule has no day-by-day surah portions to generate from');
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: dto.studentIds }, branchId },
      select: { id: true },
    });
    if (students.length !== dto.studentIds.length) {
      throw new BadRequestException('One or more studentIds do not belong to this branch');
    }

    const startDate = new Date(dto.startDate);
    const created: Prisma.SurahHifdhStudentScheduleGetPayload<Record<string, never>>[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const student of students) {
        // Legacy getNextScheduleNo: each generation call for a student is a
        // new "version" of their schedule, one higher than their current max.
        const maxScheduleNo = await tx.surahHifdhStudentSchedule.aggregate({
          where: { studentId: student.id },
          _max: { scheduleNo: true },
        });
        const scheduleNo = (maxScheduleNo._max.scheduleNo ?? 0) + 1;

        for (const target of targets) {
          const scheduledDate = new Date(startDate);
          scheduledDate.setUTCDate(scheduledDate.getUTCDate() + (target.dayNumber - 1));

          const existing = await tx.surahHifdhStudentSchedule.findFirst({
            where: { studentId: student.id, surahId: target.surahId, scheduledDate },
          });
          if (existing) continue;

          const row = await tx.surahHifdhStudentSchedule.create({
            data: {
              studentId: student.id,
              surahId: target.surahId,
              teacherId,
              fromAyah: target.fromAyah,
              toAyah: target.toAyah,
              scheduledDate,
              scheduleNo,
              day: target.dayNumber,
              status: 'PENDING',
              surahTargetId: target.id,
              pageNumberFrom: target.pageNumberFrom,
              pageNumberTo: target.pageNumberTo,
              lineFrom: target.lineFrom,
              lineTo: target.lineTo,
              portionDescription: target.portionDescription,
              difficultyLevel: target.difficultyLevel,
              priority: target.priority,
              scheduleType: target.scheduleType,
              examName: target.examName,
              estimatedDurationMinutes: target.estimatedDurationMinutes,
            },
          });
          created.push(row);
        }
      }
    });

    return { created: created.length, items: created };
  }

  /**
   * Mirrors the legacy StudentController@createInitialHifdhSchedules —
   * triggered automatically when a new student is assigned to a Halqa at
   * creation time (see StudentsService.create / AdmissionsService.approve),
   * not called directly from a controller. Only HIFDH-stage target rows are
   * used (legacy hardcodes `stage = 'Hifdh'`). scheduledDate is literally
   * `startDate + (dayNumber - 1) days` with no holiday-skipping applied —
   * legacy computes a holiday-aware date via getNextWorkingDay() but never
   * actually uses it for the persisted row, so this replicates the real
   * (buggy) behavior, not the apparent intent. Never throws: a failure here
   * must not block student creation, matching legacy's own try/catch.
   */
  async generateInitialSchedulesForStudent(studentId: string, halqaId: string, startDate?: string): Promise<void> {
    try {
      const targets = await this.prisma.surahTargetSchedule.findMany({
        where: { stage: 'HIFDH', surahId: { not: null }, fromAyah: { not: null }, toAyah: { not: null } },
        orderBy: { dayNumber: 'asc' },
      });
      if (targets.length === 0) return;

      const base = startDate ? new Date(startDate) : new Date();
      const baseUtc = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
      const scheduledSurahIds = new Set<string>();

      for (const target of targets) {
        if (!target.surahId || target.fromAyah === null || target.toAyah === null) continue;

        const scheduledDate = new Date(baseUtc);
        scheduledDate.setUTCDate(scheduledDate.getUTCDate() + (target.dayNumber - 1));

        await this.prisma.surahHifdhStudentSchedule.create({
          data: {
            studentId,
            halqaId,
            surahTargetId: target.id,
            surahId: target.surahId,
            fromAyah: target.fromAyah,
            toAyah: target.toAyah,
            scheduledDate,
            day: target.dayNumber,
            status: 'PENDING',
            completionPercentage: 0,
            pageNumberFrom: target.pageNumberFrom,
            pageNumberTo: target.pageNumberTo,
            lineFrom: target.lineFrom,
            lineTo: target.lineTo,
            portionDescription: target.portionDescription,
            difficultyLevel: target.difficultyLevel,
            priority: target.priority,
            scheduleType: target.scheduleType,
            examName: target.examName,
            estimatedDurationMinutes: target.estimatedDurationMinutes,
          },
        });
        scheduledSurahIds.add(target.surahId);
      }

      // Mirrors the legacy CreateStudentSurahProgressJob, eagerly seeding a
      // progress row per surah right after schedule generation — adapted to
      // this schema's cumulative per-surah aggregate (legacy seeded one row
      // per ayah instead, since its StudentSurahProgress table was
      // per-ayah-granular). skipDuplicates guards re-runs and the
      // studentId_surahId unique constraint.
      if (scheduledSurahIds.size > 0) {
        await this.prisma.studentSurahProgress.createMany({
          data: [...scheduledSurahIds].map((surahId) => ({
            studentId,
            surahId,
            ayahsCompleted: 0,
            status: 'IN_PROGRESS' as const,
          })),
          skipDuplicates: true,
        });
      }
    } catch {
      // Swallow — schedule generation failing must never break student creation.
    }
  }

  /** Student-side "I've done this portion" — moves it to NEEDS_REVIEW, awaiting teacher verification. */
  async markCompleted(id: string) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status === 'COMPLETED') {
      throw new ConflictException('A verified schedule cannot be marked completed again');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surahHifdhStudentSchedule.update({
        where: { id },
        data: { status: 'NEEDS_REVIEW', completedAt: new Date() },
      });
      await this.recalculateSurahProgress(tx, schedule.studentId, schedule.surahId);
      return updated;
    });
  }

  async markInProgress(id: string) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status === 'COMPLETED') {
      throw new ConflictException('A verified schedule cannot be reverted');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surahHifdhStudentSchedule.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startedAt: schedule.startedAt ?? new Date() },
      });
      await this.recalculateSurahProgress(tx, schedule.studentId, schedule.surahId);
      return updated;
    });
  }

  /** Teacher confirmation — the terminal state (legacy's old "VERIFIED"). */
  async verifySchedule(id: string, teacherId: string) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status !== 'NEEDS_REVIEW') {
      throw new ConflictException('Only a schedule awaiting review can be verified');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surahHifdhStudentSchedule.update({
        where: { id },
        data: { status: 'COMPLETED' },
      });
      await this.recalculateSurahProgress(tx, schedule.studentId, schedule.surahId, teacherId);
      return updated;
    });
  }

  /**
   * Creates a NEW schedule row for a different date, linked back via
   * rescheduledFromId — the old row is left untouched (not deleted, not
   * status-mutated) so the full reschedule chain stays visible via the
   * rescheduledFrom/rescheduledTo relations in list responses.
   */
  async reschedule(id: string, dto: RescheduleDto) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status === 'COMPLETED') {
      throw new ConflictException('A verified schedule cannot be rescheduled');
    }
    return this.prisma.surahHifdhStudentSchedule.create({
      data: {
        studentId: schedule.studentId,
        surahId: schedule.surahId,
        teacherId: schedule.teacherId,
        surahTargetId: schedule.surahTargetId,
        pageNumberFrom: schedule.pageNumberFrom,
        pageNumberTo: schedule.pageNumberTo,
        lineFrom: schedule.lineFrom,
        lineTo: schedule.lineTo,
        portionDescription: schedule.portionDescription,
        fromAyah: schedule.fromAyah,
        toAyah: schedule.toAyah,
        scheduledDate: new Date(dto.newDate),
        rescheduledFromId: schedule.id,
        status: 'PENDING',
      },
    });
  }

  /**
   * Per-student roll-up for the Progress Summary tab: one row per active
   * student in the branch (not per schedule/progress row), ordered by their
   * current Halqa's name then their own name. Students with no schedules yet
   * still appear, with zeroed counts. `overdueCount` mirrors the legacy
   * definition — not-yet-COMPLETED rows whose scheduledDate is in the past.
   */
  async getProgressSummary(branchId: string, halqaId?: string) {
    const students = await this.prisma.student.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
        ...(halqaId && { halqaMemberships: { some: { halqaId, removedAt: null } } }),
      },
      include: {
        halqaMemberships: {
          where: { removedAt: null },
          include: { halqa: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    });

    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) return [];

    const [totalGroups, completedGroups, overdueGroups] = await Promise.all([
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds } },
        _count: { _all: true },
      }),
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, status: 'COMPLETED' },
        _count: { _all: true },
      }),
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          status: { not: 'COMPLETED' },
          scheduledDate: { lt: new Date() },
        },
        _count: { _all: true },
      }),
    ]);

    const totalMap = new Map(totalGroups.map((g) => [g.studentId, g._count._all]));
    const completedMap = new Map(completedGroups.map((g) => [g.studentId, g._count._all]));
    const overdueMap = new Map(overdueGroups.map((g) => [g.studentId, g._count._all]));

    const rows = students.map((s) => {
      const halqa = s.halqaMemberships[0]?.halqa ?? null;
      const totalSchedules = totalMap.get(s.id) ?? 0;
      const completedSchedules = completedMap.get(s.id) ?? 0;
      return {
        studentId: s.id,
        studentName: s.name,
        studentCode: s.studentCode,
        halqaId: halqa?.id ?? null,
        halqaName: halqa?.name ?? null,
        totalSchedules,
        completedSchedules,
        completionPercentage:
          totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 10000) / 100 : 0,
        overdueCount: overdueMap.get(s.id) ?? 0,
      };
    });

    rows.sort((a, b) => {
      const halqaCompare = (a.halqaName ?? '￿').localeCompare(b.halqaName ?? '￿');
      return halqaCompare !== 0 ? halqaCompare : a.studentName.localeCompare(b.studentName);
    });

    return rows;
  }

  // ── Cumulative per-surah progress ─────────────────────────────────────

  listProgress(studentId?: string, surahId?: string, status?: string) {
    return this.prisma.studentSurahProgress.findMany({
      where: {
        ...(studentId && { studentId }),
        ...(surahId && { surahId }),
        ...(status && { status: status as never }),
      },
      include: {
        student: { select: { id: true, name: true, studentCode: true } },
        surah: { select: { number: true, nameEnglish: true, totalAyahs: true } },
        verifiedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Recomputes a student's cumulative StudentSurahProgress from their
   * NEEDS_REVIEW/COMPLETED schedule rows for that surah (in the schedule's
   * own HifdhScheduleStatus vocabulary — COMPLETED there means
   * teacher-confirmed, matching this method's own VERIFIED concept).
   * ayahsCompleted is the furthest `toAyah` reached, never a naive sum
   * (schedules can overlap on reschedule), and status only advances to
   * COMPLETED once the whole surah is covered, or VERIFIED when a
   * verification call passes a teacherId.
   */
  private async recalculateSurahProgress(
    tx: Prisma.TransactionClient,
    studentId: string,
    surahId: string,
    verifyingTeacherId?: string,
  ) {
    const [schedules, surah] = await Promise.all([
      tx.surahHifdhStudentSchedule.findMany({
        where: { studentId, surahId, status: { in: ['NEEDS_REVIEW', 'COMPLETED'] } },
      }),
      tx.surah.findUniqueOrThrow({ where: { id: surahId } }),
    ]);

    const ayahsCompleted = schedules.reduce((max, s) => Math.max(max, s.toAyah), 0);
    const wholeSurahDone = ayahsCompleted >= surah.totalAyahs;
    const anyVerified = schedules.some((s) => s.status === 'COMPLETED');

    const status = verifyingTeacherId && wholeSurahDone
      ? 'VERIFIED'
      : anyVerified && wholeSurahDone
        ? 'VERIFIED'
        : wholeSurahDone
          ? 'COMPLETED'
          : 'IN_PROGRESS';

    const existing = await tx.studentSurahProgress.findUnique({
      where: { studentId_surahId: { studentId, surahId } },
    });

    const data = {
      ayahsCompleted,
      status: status as never,
      completedAt: wholeSurahDone ? (existing?.completedAt ?? new Date()) : null,
      ...(verifyingTeacherId && wholeSurahDone
        ? { verifiedAt: new Date(), verifiedById: verifyingTeacherId }
        : {}),
    };

    if (existing) {
      return tx.studentSurahProgress.update({ where: { id: existing.id }, data });
    }
    return tx.studentSurahProgress.create({ data: { studentId, surahId, ...data } });
  }

  async verifyProgressDirect(id: string, teacherId: string) {
    const progress = await this.prisma.studentSurahProgress.findUnique({ where: { id } });
    if (!progress) {
      throw new NotFoundException('Student Surah progress record not found');
    }
    if (progress.status !== 'COMPLETED') {
      throw new ConflictException('Only COMPLETED progress can be verified');
    }
    return this.prisma.studentSurahProgress.update({
      where: { id },
      data: { status: 'VERIFIED', verifiedAt: new Date(), verifiedById: teacherId },
    });
  }
}
