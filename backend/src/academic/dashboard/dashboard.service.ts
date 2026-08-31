import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AcademicDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(branchId: string) {
    const [
      totalStudents,
      activeStudents,
      hifdhScheduleCounts,
      halqas,
      entryTotalGroups,
      entryVerifiedGroups,
    ] = await Promise.all([
      this.prisma.student.count({ where: { branchId } }),
      this.prisma.student.count({ where: { branchId, status: 'ACTIVE' } }),
      this.prisma.surahHifdhStudentSchedule.groupBy({
        by: ['status'],
        where: { student: { branchId } },
        _count: { _all: true },
      }),
      this.prisma.halqa.findMany({
        where: { branchId },
        select: {
          id: true,
          name: true,
          students: { where: { removedAt: null }, select: { id: true } },
        },
        orderBy: { name: 'asc' },
      }),
      // A surah is "verified" for a student once every one of its ayah
      // entries (StudentSurahProgressEntry, type NEW_LESSON) is VERIFIED —
      // compared per (studentId, surahId) below rather than via a single
      // cumulative row (see HifdhService.listProgress for the same pattern).
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId', 'surahId'],
        where: { type: 'NEW_LESSON', student: { branchId } },
        _count: { _all: true },
      }),
      this.prisma.studentSurahProgressEntry.groupBy({
        by: ['studentId', 'surahId'],
        where: { type: 'NEW_LESSON', status: 'VERIFIED', student: { branchId } },
        _count: { _all: true },
      }),
    ]);

    const hifdhCompletionSummary = {
      IN_PROGRESS: 0,
      COMPLETED: 0,
      VERIFIED: 0,
    };
    for (const row of hifdhScheduleCounts) {
      hifdhCompletionSummary[row.status] = row._count._all;
    }

    const halqaBreakdown = halqas.map((h) => ({
      halqaId: h.id,
      halqaName: h.name,
      studentCount: h.students.length,
    }));

    const verifiedCountByKey = new Map(
      entryVerifiedGroups.map((g) => [`${g.studentId}:${g.surahId}`, g._count._all]),
    );
    const verifiedSurahsByStudent = new Map<string, number>();
    for (const g of entryTotalGroups) {
      if (!g.surahId) continue;
      const verifiedCount = verifiedCountByKey.get(`${g.studentId}:${g.surahId}`) ?? 0;
      if (verifiedCount === g._count._all) {
        verifiedSurahsByStudent.set(g.studentId, (verifiedSurahsByStudent.get(g.studentId) ?? 0) + 1);
      }
    }
    const surahLeaderboard = [...verifiedSurahsByStudent.entries()]
      .map(([studentId, completedCount]) => ({ studentId, completedCount }))
      .sort((a, b) => b.completedCount - a.completedCount)
      .slice(0, 10);

    const leaderboardStudentIds = surahLeaderboard.map((r) => r.studentId);
    const students = leaderboardStudentIds.length
      ? await this.prisma.student.findMany({
          where: { id: { in: leaderboardStudentIds } },
          select: { id: true, name: true },
        })
      : [];
    const studentById = new Map(students.map((s) => [s.id, s]));

    const surahLeaderboardResult = surahLeaderboard.map((row) => ({
      studentId: row.studentId,
      studentName: studentById.get(row.studentId)?.name ?? 'Unknown',
      completedCount: row.completedCount,
    }));

    return {
      totalStudents,
      activeStudents,
      hifdhCompletionSummary,
      halqaBreakdown,
      surahLeaderboard: surahLeaderboardResult,
    };
  }
}
