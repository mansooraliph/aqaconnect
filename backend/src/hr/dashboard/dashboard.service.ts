import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HrDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(branchId: string) {
    const [
      activeEmployees,
      activeTeachers,
      pendingLeaveRequests,
      pendingTeacherApplications,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { branchId, status: 'ACTIVE' } }),
      this.prisma.teacher.count({ where: { branchId, status: 'ACTIVE' } }),
      this.prisma.leave.count({
        where: { branchId, status: { in: ['PENDING', 'PRE_APPROVED'] } },
      }),
      this.prisma.teacherApplication.count({
        where: { branchId, status: 'PENDING' },
      }),
    ]);

    return {
      activeEmployees,
      activeTeachers,
      pendingLeaveRequests,
      pendingTeacherApplications,
    };
  }
}
