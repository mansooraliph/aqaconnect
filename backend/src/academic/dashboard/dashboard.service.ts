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
      surahLeaderboard,
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
      this.prisma.studentSurahProgress.groupBy({
        by: ['studentId'],
        where: { status: 'VERIFIED', student: { branchId } },
        _count: { _all: true },
        orderBy: { _count: { studentId: 'desc' } },
        take: 10,
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

    const leaderboardStudentIds = surahLeaderboard.map((r) => r.studentId);
    const students = leaderboardStudentIds.length
      ? await this.prisma.student.findMany({
          where: { id: { in: leaderboardStudentIds } },
          select: { id: true, name: true },
        })
      : [];
    const studentById = new Map(students.map((s) => [s.id, s]));

    const surahLeaderboardResult = surahLeaderboard.map((row) => {
      const student = studentById.get(row.studentId);
      return {
        studentId: row.studentId,
        studentName: student ? student.name : 'Unknown',
        completedCount: row._count._all,
      };
    });

    return {
      totalStudents,
      activeStudents,
      hifdhCompletionSummary,
      halqaBreakdown,
      surahLeaderboard: surahLeaderboardResult,
    };
  }
}
