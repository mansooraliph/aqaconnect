import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ProgressEntryStatus } from '@prisma/client';
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

  listSchedules(
    studentId?: string,
    surahId?: string,
    status?: string,
    fromDate?: string,
    toDate?: string,
    fromDay?: string,
    toDay?: string,
    scheduleType?: string,
  ) {
    return this.prisma.surahHifdhStudentSchedule.findMany({
      where: {
        // A row that's been rescheduled (rescheduledTo set) is superseded by
        // its replacement — listing both would show the same day-slot twice.
        // Single reschedule() refuses to touch COMPLETED rows, so those stay
        // as the sole surviving row; bulkReschedule() copies COMPLETED rows
        // forward too (same date/status) so their history isn't left behind
        // on an otherwise-superseded old schedule — either way, only the
        // latest (non-superseded) row for a given slot is shown here.
        rescheduledTo: { none: {} },
        ...(studentId && { studentId }),
        ...(surahId && { surahId }),
        ...(status && { status: status as never }),
        ...(scheduleType && { scheduleType }),
        ...((fromDate || toDate) && {
          scheduledDate: {
            ...(fromDate && { gte: new Date(fromDate) }),
            ...(toDate && { lte: new Date(toDate) }),
          },
        }),
        ...((fromDay || toDay) && {
          day: {
            ...(fromDay && { gte: Number(fromDay) }),
            ...(toDay && { lte: Number(toDay) }),
          },
        }),
      },
      include: {
        student: { select: { id: true, name: true, studentCode: true } },
        surah: { select: { number: true, nameEnglish: true } },
        surahTarget: { select: { sortOrder: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        rescheduledFrom: true,
        rescheduledTo: true,
      },
      // scheduledDate alone doesn't uniquely order multi-row days (a sabaq +
      // several sabqi/manzil rows can share one date) — day/surahTarget's own
      // sortOrder as tiebreaks keep the list in the same sequence as the
      // master target schedule, regardless of the order rows happened to be
      // (re)created in. createdAt is NOT a safe tiebreak here: bulkReschedule
      // creates a day's replacement rows in whatever order they were fetched
      // (no within-day ordering), so createdAt drifts from the intended plan
      // order after a reschedule.
      orderBy: [{ scheduledDate: 'asc' }, { day: 'asc' }, { surahTarget: { sortOrder: 'asc' } }],
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
   * single shared template. Milestone rows with no surah portion ("Exam",
   * "Preparation") are included too — surahId/fromAyah/toAyah come back
   * null and examName carries the descriptive text.
   */
  async generateSchedules(branchId: string, teacherId: string | undefined, dto: GenerateSchedulesDto) {
    const targets = await this.prisma.surahTargetSchedule.findMany({
      orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
    });
    if (targets.length === 0) {
      throw new BadRequestException('The target schedule has no day-by-day rows to generate from');
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
            where: { studentId: student.id, surahTargetId: target.id },
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
  async generateInitialSchedulesForStudent(
    studentId: string,
    branchId: string,
    halqaId: string,
    startDate?: string,
  ): Promise<void> {
    try {
      const targets = await this.prisma.surahTargetSchedule.findMany({
        where: { stage: 'HIFDH' },
        orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
      });
      if (targets.length === 0) return;

      const base = startDate ? new Date(startDate) : new Date();
      const baseUtc = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
      // One row per individual ayah (legacy's own per-ayah granularity, see
      // StudentSurahProgressEntry) — deduped across target rows so an ayah
      // revisited by a later HIFDH-stage row (e.g. a revision pass) doesn't
      // get a second "new lesson" entry.
      const seenAyahs = new Set<string>();
      const progressEntries: { surahId: string; fromAyah: number; toAyah: number; day: number }[] = [];

      for (const target of targets) {
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

        // Milestone rows ("Preparation"/"Exam") carry no surah portion — they
        // still get a schedule row above, but there's no ayah range to seed
        // into the per-ayah progress ledger.
        if (!target.surahId || target.fromAyah === null || target.toAyah === null) continue;

        for (let ayah = target.fromAyah; ayah <= target.toAyah; ayah++) {
          const key = `${target.surahId}:${ayah}`;
          if (seenAyahs.has(key)) continue;
          seenAyahs.add(key);
          progressEntries.push({ surahId: target.surahId, fromAyah: ayah, toAyah: ayah, day: target.dayNumber });
        }
      }

      // Seeds the shared per-ayah progress ledger (StudentSurahProgressEntry)
      // that both the admin portal and the mobile app read/write — the
      // single source of truth for Hifdh progress, kept in sync between the
      // two going forward via HifdhService's own mark-completed/verify calls
      // and the mobile app's own endpoints.
      if (progressEntries.length > 0) {
        await this.prisma.studentSurahProgressEntry.createMany({
          data: progressEntries.map((e) => ({
            branchId,
            studentId,
            surahId: e.surahId,
            fromAyah: e.fromAyah,
            toAyah: e.toAyah,
            day: e.day,
            type: 'NEW_LESSON' as const,
            status: 'NOT_STARTED' as const,
          })),
        });
      }
    } catch {
      // Swallow — schedule generation failing must never break student creation.
    }
  }

  /**
   * Pushes a schedule-row status change onto the matching ayah-range of
   * StudentSurahProgressEntry rows — the same per-ayah ledger the mobile app
   * reads and writes (type NEW_LESSON only, so mobile's own Old/Juzh Lesson
   * entries are never touched). No-ops for milestone rows (no surah
   * portion). `fromStatus` scopes which entries are eligible to advance, so
   * e.g. verify only promotes ayahs already COMPLETED rather than skipping
   * NOT_STARTED/IN_PROGRESS ones straight to VERIFIED.
   */
  private async syncProgressEntries(
    tx: Prisma.TransactionClient,
    schedule: { studentId: string; surahId: string | null; fromAyah: number | null; toAyah: number | null },
    fromStatus: ProgressEntryStatus | ProgressEntryStatus[],
    data: Prisma.StudentSurahProgressEntryUncheckedUpdateManyInput,
  ) {
    if (!schedule.surahId || schedule.fromAyah === null || schedule.toAyah === null) return;
    await tx.studentSurahProgressEntry.updateMany({
      where: {
        studentId: schedule.studentId,
        surahId: schedule.surahId,
        type: 'NEW_LESSON',
        fromAyah: { gte: schedule.fromAyah, lte: schedule.toAyah },
        status: Array.isArray(fromStatus) ? { in: fromStatus } : fromStatus,
      },
      data,
    });
  }

  /**
   * Teacher/admin-side "this portion is done" — goes straight to COMPLETED
   * (verified) in one step. Unlike the mobile app's student self-report flow
   * (a separate endpoint that still lands on NEEDS_REVIEW for a teacher to
   * review later), the actor calling this one already holds
   * academic.hifdh_progress.mark, so there's no one else left to review it
   * — a separate verify step would just be busywork.
   */
  async markCompleted(id: string, userId?: string) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status === 'COMPLETED') {
      throw new ConflictException('A verified schedule cannot be marked completed again');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surahHifdhStudentSchedule.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await this.syncProgressEntries(
        tx,
        schedule,
        [ProgressEntryStatus.NOT_STARTED, ProgressEntryStatus.IN_PROGRESS, ProgressEntryStatus.COMPLETED],
        {
          status: ProgressEntryStatus.VERIFIED,
          completedAt: new Date(),
          verifiedAt: new Date(),
          verifiedById: userId,
          ...(userId && { lastUpdatedById: userId }),
        },
      );
      return updated;
    });
  }

  async markInProgress(id: string, userId?: string) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status === 'COMPLETED') {
      throw new ConflictException('A verified schedule cannot be reverted');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surahHifdhStudentSchedule.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startedAt: schedule.startedAt ?? new Date() },
      });
      await this.syncProgressEntries(tx, schedule, [ProgressEntryStatus.NOT_STARTED, ProgressEntryStatus.COMPLETED], {
        status: ProgressEntryStatus.IN_PROGRESS,
        ...(userId && { lastUpdatedById: userId }),
      });
      return updated;
    });
  }

  /** Confirmation — the terminal state (legacy's old "VERIFIED"). */
  async verifySchedule(id: string, userId?: string) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status !== 'NEEDS_REVIEW') {
      throw new ConflictException('Only a schedule awaiting review can be verified');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surahHifdhStudentSchedule.update({
        where: { id },
        data: { status: 'COMPLETED' },
      });
      await this.syncProgressEntries(tx, schedule, ProgressEntryStatus.COMPLETED, {
        status: ProgressEntryStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: userId,
        ...(userId && { lastUpdatedById: userId }),
      });
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
    // A single-row nudge (e.g. one missed day) doesn't start a new schedule
    // generation — the replacement keeps the same scheduleNo as the row it
    // replaces, unlike bulkReschedule() which bumps it.
    return this.prisma.surahHifdhStudentSchedule.create({
      data: this.rescheduleRowData(schedule, new Date(dto.newDate), false, schedule.scheduleNo),
    });
  }

  /**
   * Builds the create-data for a schedule row's replacement — either shifted
   * to a new date (pending items, status reset to PENDING) or an unchanged
   * copy (completed items, same date/status, so their history carries over
   * to the new schedule instead of being left behind on the invalidated
   * old one).
   */
  private rescheduleRowData(
    schedule: Prisma.SurahHifdhStudentScheduleGetPayload<Record<string, never>>,
    scheduledDate: Date,
    preserveCompletion: boolean,
    scheduleNo: number,
  ) {
    return {
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
      day: schedule.day,
      scheduleType: schedule.scheduleType,
      examName: schedule.examName,
      estimatedDurationMinutes: schedule.estimatedDurationMinutes,
      difficultyLevel: schedule.difficultyLevel,
      priority: schedule.priority,
      scheduledDate,
      scheduleNo,
      rescheduledFromId: schedule.id,
      ...(preserveCompletion
        ? {
            status: schedule.status,
            completionDate: schedule.completionDate,
            completionPercentage: schedule.completionPercentage,
            memorizationQuality: schedule.memorizationQuality,
            teacherNotes: schedule.teacherNotes,
            studentNotes: schedule.studentNotes,
            revisionCount: schedule.revisionCount,
            lastRevisionDate: schedule.lastRevisionDate,
            nextRevisionDue: schedule.nextRevisionDue,
            actualDurationMinutes: schedule.actualDurationMinutes,
            startedAt: schedule.startedAt,
            completedAt: schedule.completedAt,
          }
        : { status: 'PENDING' as const }),
    };
  }

  /**
   * Bulk, per-student version of reschedule() — used to shift a student's (or
   * several students') whole remaining schedule after a disruption (absence,
   * holiday, curriculum restart), rather than one row at a time. Pending
   * (not-yet-COMPLETED) rows get a new shifted copy; COMPLETED rows get an
   * unchanged copy (same date/status) so their history carries over to the
   * new schedule too. Either way, every row not already superseded by an
   * earlier reschedule is replaced — the old rows are left in place but
   * become superseded (and so excluded from progress-summary totals) via the
   * rescheduledFrom/rescheduledTo relation. Preserves the original
   * day-to-day spacing for shifted rows: every one moves by the same delta
   * (newStartDate minus that student's earliest affected pending row), so a
   * multi-row day stays a multi-row day instead of being compressed onto
   * consecutive dates.
   */
  async bulkReschedule(studentIds: string[], newStartDate: string, fromDate?: string) {
    let rescheduled = 0;
    let copied = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const studentId of studentIds) {
        const rows = await tx.surahHifdhStudentSchedule.findMany({
          where: {
            studentId,
            rescheduledTo: { none: {} },
            ...(fromDate && { scheduledDate: { gte: new Date(fromDate) } }),
          },
          orderBy: { scheduledDate: 'asc' },
        });
        if (rows.length === 0) continue;

        // Only the pending rows actually start a new schedule generation —
        // they're the ones being shifted to a new plan. Completed rows are
        // just being copied forward (unchanged) so they stay visible after
        // the old, now-superseded row is filtered out of listings; they
        // keep the scheduleNo of the generation they were actually
        // completed under, not the new one.
        const nextScheduleNo = Math.max(...rows.map((r) => r.scheduleNo)) + 1;

        const pendingRows = rows.filter((r) => r.status !== 'COMPLETED');
        const completedRows = rows.filter((r) => r.status === 'COMPLETED');

        if (pendingRows.length > 0) {
          const deltaMs = new Date(newStartDate).getTime() - pendingRows[0].scheduledDate.getTime();
          for (const row of pendingRows) {
            await tx.surahHifdhStudentSchedule.create({
              data: this.rescheduleRowData(
                row,
                new Date(row.scheduledDate.getTime() + deltaMs),
                false,
                nextScheduleNo,
              ),
            });
            rescheduled++;
          }
        }

        for (const row of completedRows) {
          await tx.surahHifdhStudentSchedule.create({
            data: this.rescheduleRowData(row, row.scheduledDate, true, row.scheduleNo),
          });
          copied++;
        }
      }
    });
    return { rescheduled, copied };
  }

  /**
   * Per-student roll-up for the Progress Summary tab: one row per active
   * student in the branch (not per schedule/progress row), ordered by their
   * current Halqa's name then their own name. Students with no schedules yet
   * still appear, with zeroed counts. `overdueCount` mirrors the legacy
   * definition — not-yet-COMPLETED rows whose scheduledDate is in the past.
   */
  async getProgressSummary(branchId: string, halqaId?: string, studentId?: string) {
    const students = await this.prisma.student.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
        ...(halqaId && { halqaMemberships: { some: { halqaId, removedAt: null } } }),
        ...(studentId && { id: studentId }),
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

    // Rows superseded by a later reschedule (rescheduledTo set) are excluded
    // throughout — they're historical, not part of the student's active
    // schedule, so they shouldn't count toward totals/completed/overdue.
    const [totalGroups, completedGroups, overdueGroups] = await Promise.all([
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, rescheduledTo: { none: {} } },
        _count: { _all: true },
      }),
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, status: 'COMPLETED', rescheduledTo: { none: {} } },
        _count: { _all: true },
      }),
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          status: { not: 'COMPLETED' },
          scheduledDate: { lt: new Date() },
          rescheduledTo: { none: {} },
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

  // ── Per-surah progress, aggregated from StudentSurahProgressEntry ──────
  // This is the same per-ayah ledger the mobile app reads/writes (see
  // mobile-app-api/student-surah-progress) — the admin "Progress by Surah"
  // view is a synthetic per-(student, surah) rollup over those rows (type
  // NEW_LESSON only), not a separately-maintained table, so the two stay in
  // sync by construction rather than by keeping two stores updated in
  // lockstep.

  async listProgress(
    studentId?: string,
    surahId?: string,
    status?: string,
    orderBy: 'schedule' | 'surah_number' = 'schedule',
  ) {
    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: {
        type: 'NEW_LESSON',
        surahId: { not: null },
        ...(studentId && { studentId }),
        ...(surahId && { surahId }),
      },
      include: {
        student: { select: { id: true, name: true, studentCode: true } },
        surah: { select: { number: true, nameEnglish: true, totalAyahs: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
        lastUpdatedBy: { select: { firstName: true, lastName: true } },
      },
    });

    interface Group {
      studentId: string;
      surahId: string;
      student: { id: string; name: string; studentCode: string };
      surah: { number: number; nameEnglish: string; totalAyahs: number };
      total: number;
      completedOrVerified: number;
      allVerified: boolean;
      latestVerifiedAt: Date | null;
      latestVerifiedBy: { firstName: string; lastName: string | null } | null;
      latestCompletedAt: Date | null;
      latestMarkedBy: { firstName: string; lastName: string | null } | null;
    }

    const groups = new Map<string, Group>();
    for (const e of entries) {
      if (!e.surahId || !e.surah) continue;
      const key = `${e.studentId}:${e.surahId}`;
      const g = groups.get(key) ?? {
        studentId: e.studentId,
        surahId: e.surahId,
        student: e.student,
        surah: e.surah,
        total: 0,
        completedOrVerified: 0,
        allVerified: true,
        latestVerifiedAt: null,
        latestVerifiedBy: null,
        latestCompletedAt: null,
        latestMarkedBy: null,
      };
      g.total += 1;
      if (e.status === ProgressEntryStatus.COMPLETED || e.status === ProgressEntryStatus.VERIFIED) {
        g.completedOrVerified += 1;
      }
      if (e.status !== ProgressEntryStatus.VERIFIED) g.allVerified = false;
      if (e.verifiedBy && (!g.latestVerifiedAt || (e.verifiedAt && e.verifiedAt > g.latestVerifiedAt))) {
        g.latestVerifiedAt = e.verifiedAt;
        g.latestVerifiedBy = e.verifiedBy;
      }
      if (e.completedAt && (!g.latestCompletedAt || e.completedAt > g.latestCompletedAt)) {
        g.latestCompletedAt = e.completedAt;
        g.latestMarkedBy = e.lastUpdatedBy;
      }
      groups.set(key, g);
    }

    const rows = [...groups.values()].map((g) => ({
      id: `${g.studentId}:${g.surahId}`,
      studentId: g.studentId,
      surahId: g.surahId,
      ayahsCompleted: g.completedOrVerified,
      status:
        g.total > 0 && g.allVerified
          ? ('VERIFIED' as const)
          : g.total > 0 && g.completedOrVerified === g.total
            ? ('COMPLETED' as const)
            : ('IN_PROGRESS' as const),
      verifiedBy: g.latestVerifiedBy,
      completedAt: g.latestCompletedAt,
      markedBy: g.latestMarkedBy,
      student: g.student,
      surah: g.surah,
    }));

    const filtered = status ? rows.filter((r) => r.status === status) : rows;

    if (orderBy === 'schedule' && studentId) {
      const scheduleRank = await this.surahScheduleOrderRank(studentId);
      filtered.sort((a, b) => {
        const ra = scheduleRank.get(a.surahId);
        const rb = scheduleRank.get(b.surahId);
        // Surahs with no schedule row yet (e.g. legacy progress data) sort
        // after everything that does have one, by surah number among
        // themselves.
        if (ra === undefined && rb === undefined) return a.surah.number - b.surah.number;
        if (ra === undefined) return 1;
        if (rb === undefined) return -1;
        return ra - rb;
      });
    } else {
      filtered.sort((a, b) => a.surah.number - b.surah.number);
    }

    return filtered;
  }

  /**
   * Maps surahId -> the position it first appears in this student's own
   * day-wise Hifdh schedule (day, then that day's plan sortOrder) — the
   * "Schedule order" option in the Progress-by-Surah view, so a surah shows
   * up in the same order the student is actually memorizing it in rather
   * than canonical Quran (surah number) order.
   */
  private async surahScheduleOrderRank(studentId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: { studentId, rescheduledTo: { none: {} }, surahId: { not: null } },
      select: { surahId: true, day: true, surahTarget: { select: { sortOrder: true } } },
      orderBy: [{ day: 'asc' }, { surahTarget: { sortOrder: 'asc' } }],
    });
    const rank = new Map<string, number>();
    let i = 0;
    for (const row of rows) {
      if (row.surahId && !rank.has(row.surahId)) {
        rank.set(row.surahId, i);
        i += 1;
      }
    }
    return rank;
  }

  /** Bulk-verifies every COMPLETED (student-done, awaiting-review) ayah entry for one student+surah. */
  async verifySurahProgress(studentId: string, surahId: string, userId?: string) {
    const result = await this.prisma.studentSurahProgressEntry.updateMany({
      where: { studentId, surahId, type: 'NEW_LESSON', status: ProgressEntryStatus.COMPLETED },
      data: {
        status: ProgressEntryStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: userId,
        ...(userId && { lastUpdatedById: userId }),
      },
    });
    if (result.count === 0) {
      throw new ConflictException('No completed ayahs awaiting verification were found for this surah');
    }
    return { verified: result.count };
  }
}
