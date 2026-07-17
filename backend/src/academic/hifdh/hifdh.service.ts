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
        student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
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
   * Generates one schedule row per (student x target day) from a
   * SurahTargetSchedule template — idempotent per (studentId, surahId,
   * scheduledDate): re-running with the same startDate skips days that
   * already have a schedule for that student, rather than duplicating.
   */
  async generateSchedules(branchId: string, teacherId: string | undefined, dto: GenerateSchedulesDto) {
    const template = await this.prisma.surahTargetSchedule.findUnique({
      where: { id: dto.surahTargetScheduleId },
      include: { targets: { orderBy: { dayNumber: 'asc' } }, surah: true },
    });
    if (!template) {
      throw new BadRequestException('surahTargetScheduleId not found');
    }
    if (template.targets.length === 0) {
      throw new BadRequestException('This target schedule has no day-by-day targets defined yet');
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
        for (const target of template.targets) {
          const scheduledDate = new Date(startDate);
          scheduledDate.setUTCDate(scheduledDate.getUTCDate() + (target.dayNumber - 1));

          const existing = await tx.surahHifdhStudentSchedule.findFirst({
            where: { studentId: student.id, surahId: template.surahId, scheduledDate },
          });
          if (existing) continue;

          const row = await tx.surahHifdhStudentSchedule.create({
            data: {
              studentId: student.id,
              surahId: template.surahId,
              teacherId,
              fromAyah: target.fromAyah,
              toAyah: target.toAyah,
              scheduledDate,
              status: 'IN_PROGRESS',
            },
          });
          created.push(row);
        }
      }
    });

    return { created: created.length, items: created };
  }

  async markCompleted(id: string) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status === 'VERIFIED') {
      throw new ConflictException('A verified schedule cannot be marked completed again');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surahHifdhStudentSchedule.update({
        where: { id },
        data: { status: 'COMPLETED' },
      });
      await this.recalculateSurahProgress(tx, schedule.studentId, schedule.surahId);
      return updated;
    });
  }

  async markInProgress(id: string) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status === 'VERIFIED') {
      throw new ConflictException('A verified schedule cannot be reverted');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surahHifdhStudentSchedule.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
      await this.recalculateSurahProgress(tx, schedule.studentId, schedule.surahId);
      return updated;
    });
  }

  async verifySchedule(id: string, teacherId: string) {
    const schedule = await this.findScheduleOrThrow(id);
    if (schedule.status !== 'COMPLETED') {
      throw new ConflictException('Only a COMPLETED schedule can be verified');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surahHifdhStudentSchedule.update({
        where: { id },
        data: { status: 'VERIFIED' },
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
    if (schedule.status === 'VERIFIED') {
      throw new ConflictException('A verified schedule cannot be rescheduled');
    }
    return this.prisma.surahHifdhStudentSchedule.create({
      data: {
        studentId: schedule.studentId,
        surahId: schedule.surahId,
        teacherId: schedule.teacherId,
        fromAyah: schedule.fromAyah,
        toAyah: schedule.toAyah,
        scheduledDate: new Date(dto.newDate),
        rescheduledFromId: schedule.id,
        status: 'IN_PROGRESS',
      },
    });
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
        student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
        surah: { select: { number: true, nameEnglish: true, totalAyahs: true } },
        verifiedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Recomputes a student's cumulative StudentSurahProgress from their
   * COMPLETED/VERIFIED schedule rows for that surah — ayahsCompleted is the
   * furthest `toAyah` reached, never a naive sum (schedules can overlap on
   * reschedule), and status only advances to COMPLETED once the whole surah
   * is covered, or VERIFIED when a verification call passes a teacherId.
   */
  private async recalculateSurahProgress(
    tx: Prisma.TransactionClient,
    studentId: string,
    surahId: string,
    verifyingTeacherId?: string,
  ) {
    const [schedules, surah] = await Promise.all([
      tx.surahHifdhStudentSchedule.findMany({
        where: { studentId, surahId, status: { in: ['COMPLETED', 'VERIFIED'] } },
      }),
      tx.surah.findUniqueOrThrow({ where: { id: surahId } }),
    ]);

    const ayahsCompleted = schedules.reduce((max, s) => Math.max(max, s.toAyah), 0);
    const wholeSurahDone = ayahsCompleted >= surah.totalAyahs;
    const anyVerified = schedules.some((s) => s.status === 'VERIFIED');

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
