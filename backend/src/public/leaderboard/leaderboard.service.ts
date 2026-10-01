import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface StudentInfo {
  name: string;
  halqaName: string | null;
}

export interface ToppersEntry {
  studentId: string;
  name: string;
  halqaName: string | null;
  targetAyahs: number;
  actualAyahs: number;
  excessAyahs: number;
}

export interface TopicsEntry {
  studentId: string;
  name: string;
  halqaName: string | null;
  topicsCount: number;
}

export interface LeaderboardResult {
  branch: { id: string; name: string };
  weeklyToppers: ToppersEntry[];
  monthlyToppers: ToppersEntry[];
  mostTopicsCovered: TopicsEntry[];
  generatedAt: string;
}

/**
 * Public, unauthenticated leaderboard for a college TV display. "Toppers" use
 * the exact same excess-ayahs definition as the mobile app's
 * students/exceeded-target endpoint (StudentSurahProgressService) — actual
 * ayahs completed in a date range minus the ayahs scheduled/targeted for that
 * same range — but computed self-contained here (no authenticated-user
 * context, no teacher-halqa scoping) since this runs with no caller identity.
 */
@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Monday (UTC, start of day) of the week containing `date`. */
  private mondayOf(date: Date): Date {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay(); // 0 = Sunday ... 6 = Saturday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diffToMonday);
    return d;
  }

  private async activeStudentInfo(branchId: string): Promise<Map<string, StudentInfo>> {
    const students = await this.prisma.student.findMany({
      where: { branchId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        halqaMemberships: {
          where: { removedAt: null },
          select: { halqa: { select: { name: true } } },
          take: 1,
        },
      },
    });

    const map = new Map<string, StudentInfo>();
    for (const s of students) {
      map.set(s.id, { name: s.name, halqaName: s.halqaMemberships[0]?.halqa.name ?? null });
    }
    return map;
  }

  private async getToppers(branchId: string, fromDate: Date, toDate: Date, limit: number): Promise<ToppersEntry[]> {
    const infoMap = await this.activeStudentInfo(branchId);
    const studentIds = Array.from(infoMap.keys());
    if (studentIds.length === 0) return [];

    const [scheduleGroups, progressGroups] = await Promise.all([
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          scheduledDate: { gte: fromDate, lte: toDate },
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
          completedAt: { gte: fromDate, lte: toDate },
          fromAyah: { not: null },
          toAyah: { not: null },
        },
        _sum: { fromAyah: true, toAyah: true },
        _count: { _all: true },
      }),
    ]);

    const targetByStudent = new Map<string, number>();
    for (const g of scheduleGroups) {
      targetByStudent.set(g.studentId, (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0) + g._count._all);
    }
    const actualByStudent = new Map<string, number>();
    for (const g of progressGroups) {
      actualByStudent.set(g.studentId, (g._sum.toAyah ?? 0) - (g._sum.fromAyah ?? 0) + g._count._all);
    }

    return studentIds
      .map((studentId) => {
        const info = infoMap.get(studentId)!;
        const targetAyahs = targetByStudent.get(studentId) ?? 0;
        const actualAyahs = actualByStudent.get(studentId) ?? 0;
        return {
          studentId,
          name: info.name,
          halqaName: info.halqaName,
          targetAyahs,
          actualAyahs,
          excessAyahs: actualAyahs - targetAyahs,
        };
      })
      .filter((r) => r.excessAyahs > 0)
      .sort((a, b) => b.excessAyahs - a.excessAyahs)
      .slice(0, limit);
  }

  private async getMostTopicsCovered(
    branchId: string,
    fromDate: Date,
    toDate: Date,
    limit: number,
  ): Promise<TopicsEntry[]> {
    const infoMap = await this.activeStudentInfo(branchId);
    const studentIds = Array.from(infoMap.keys());
    if (studentIds.length === 0) return [];

    const entries = await this.prisma.studentSurahProgressEntry.findMany({
      where: {
        branchId,
        studentId: { in: studentIds },
        status: { in: ['COMPLETED', 'VERIFIED'] },
        completedAt: { gte: fromDate, lte: toDate },
        surahId: { not: null },
      },
      select: { studentId: true, surahId: true },
      distinct: ['studentId', 'surahId'],
    });

    const countByStudent = new Map<string, number>();
    for (const e of entries) {
      countByStudent.set(e.studentId, (countByStudent.get(e.studentId) ?? 0) + 1);
    }

    return studentIds
      .map((studentId) => {
        const info = infoMap.get(studentId)!;
        return { studentId, name: info.name, halqaName: info.halqaName, topicsCount: countByStudent.get(studentId) ?? 0 };
      })
      .filter((r) => r.topicsCount > 0)
      .sort((a, b) => b.topicsCount - a.topicsCount)
      .slice(0, limit);
  }

  async getLeaderboard(branchId: string, limit: number): Promise<LeaderboardResult> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const now = new Date();
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const weekStart = this.mondayOf(now);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [weeklyToppers, monthlyToppers, mostTopicsCovered] = await Promise.all([
      this.getToppers(branchId, weekStart, endOfToday, limit),
      this.getToppers(branchId, monthStart, endOfToday, limit),
      this.getMostTopicsCovered(branchId, monthStart, endOfToday, limit),
    ]);

    return { branch, weeklyToppers, monthlyToppers, mostTopicsCovered, generatedAt: now.toISOString() };
  }
}
