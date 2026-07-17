import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudentManagementDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(branchId: string) {
    const [pendingAdmissions, totalStudents, activeStudents] = await Promise.all([
      this.prisma.admission.count({ where: { branchId, status: 'PENDING' } }),
      this.prisma.student.count({ where: { branchId } }),
      this.prisma.student.count({ where: { branchId, status: 'ACTIVE' } }),
    ]);

    return {
      pendingAdmissions,
      totalStudents,
      activeStudents,
    };
  }
}
