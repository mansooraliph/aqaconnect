import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceReportService } from './attendance-report.service';
import { MobileContextService } from '../common/mobile-context.service';

function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

const employeeInclude = { user: { select: { firstName: true, lastName: true, email: true } } } as const;

@Injectable()
export class MobileAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly report: AttendanceReportService,
    private readonly context: MobileContextService,
  ) {}

  async ownSummary(branchId: string, userId: string, year: number, month: number) {
    const employeeId = await this.context.resolveOwnEmployeeId(branchId, userId);
    const { start, end } = monthRange(year, month);
    return this.report.buildReport(branchId, employeeId, start, end, true);
  }

  async allEmployeesSummary(branchId: string, startDate: Date, endDate: Date) {
    const employees = await this.prisma.employee.findMany({ where: { branchId }, include: employeeInclude });
    const employeeSummaries = await Promise.all(
      employees.map(async (employee) => {
        const { summary } = await this.report.buildReport(branchId, employee.id, startDate, endDate, false);
        return {
          employeeId: employee.id,
          employeeName: [employee.user.firstName, employee.user.lastName].filter(Boolean).join(' '),
          employeeEmail: employee.user.email,
          ...summary,
        };
      }),
    );
    return { totalEmployees: employees.length, employeeSummaries };
  }

  async employeeReport(branchId: string, employeeId: string, startDate: Date, endDate: Date) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, branchId },
      include: employeeInclude,
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    const { summary, dailyReport } = await this.report.buildReport(branchId, employeeId, startDate, endDate, true);
    return {
      employee: {
        id: employee.id,
        name: [employee.user.firstName, employee.user.lastName].filter(Boolean).join(' '),
        email: employee.user.email,
      },
      summary,
      dailyReport,
    };
  }

  listNotApproved(branchId: string) {
    return this.prisma.attendance.findMany({
      where: { branchId, status: AttendanceStatus.PENDING_APPROVAL },
      include: { employee: { include: employeeInclude } },
      orderBy: { date: 'desc' },
    });
  }

  listApproved(branchId: string) {
    return this.prisma.attendance.findMany({
      where: { branchId, reviewedAt: { not: null }, status: { in: [AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY] } },
      include: { employee: { include: employeeInclude } },
      orderBy: { date: 'desc' },
    });
  }

  async approve(branchId: string, id: string, reviewerUserId: string) {
    const record = await this.prisma.attendance.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Attendance request not found');
    }
    if (record.status !== AttendanceStatus.PENDING_APPROVAL) {
      throw new ConflictException('This attendance request is not awaiting approval');
    }
    return this.prisma.attendance.update({
      where: { id },
      data: {
        status: AttendanceStatus.PRESENT,
        reviewedById: reviewerUserId,
        reviewedAt: new Date(),
      },
    });
  }

  async reject(branchId: string, id: string, reviewerUserId: string, reason?: string) {
    const record = await this.prisma.attendance.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Attendance request not found');
    }
    if (record.status !== AttendanceStatus.PENDING_APPROVAL) {
      throw new ConflictException('This attendance request is not awaiting approval');
    }
    return this.prisma.attendance.update({
      where: { id },
      data: {
        status: AttendanceStatus.REJECTED,
        reviewedById: reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });
  }
}
