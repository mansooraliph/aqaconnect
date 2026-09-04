import { Injectable } from '@nestjs/common';
import { AttendanceStatus, LeaveStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface DailyReportRow {
  date: string;
  day: string;
  status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE' | 'HOLIDAY' | 'PENDING_APPROVAL' | 'REJECTED';
  attendanceId: string | null;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  clockInLat: unknown;
  clockInLng: unknown;
}

export interface AttendanceSummary {
  workingDays: number;
  present: number;
  absent: number;
  leave: number;
  pendingApproval: number;
}

const LEAVE_STATUSES: LeaveStatus[] = [LeaveStatus.APPROVED, LeaveStatus.PRE_APPROVED];
const PRESENT_STATUSES: AttendanceStatus[] = [AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY];

/**
 * Shared day-by-day attendance computation, used by #9 (own summary+daily
 * rows), #10 (all-employees summary only), and #11 (one employee's
 * summary+daily rows) — one implementation instead of legacy's 3 near-copies.
 */
@Injectable()
export class AttendanceReportService {
  constructor(private readonly prisma: PrismaService) {}

  private enumerateDates(start: Date, end: Date, joiningDate: Date | null): Date[] {
    const now = new Date();
    // UTC-midnight, matching how `start`/`end`/`joiningDate` (all @db.Date columns
    // or UTC-parsed query params) are represented — mixing in local-midnight here
    // would shift the whole range by a day in any non-UTC server timezone.
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const from = joiningDate && joiningDate > start ? joiningDate : start;
    const to = end > today ? today : end;
    const dates: Date[] = [];
    for (const d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }

  async buildReport(
    branchId: string,
    employeeId: string,
    startDate: Date,
    endDate: Date,
    withDailyRows: boolean,
  ): Promise<{ summary: AttendanceSummary; dailyReport?: DailyReportRow[] }> {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, branchId } });
    const dates = this.enumerateDates(startDate, endDate, employee?.dateOfJoining ?? null);

    const [attendances, leaves] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId, branchId, date: { gte: dates[0] ?? startDate, lte: dates[dates.length - 1] ?? endDate } },
      }),
      this.prisma.leave.findMany({
        where: {
          employeeId,
          branchId,
          status: { in: LEAVE_STATUSES },
          startDate: { lte: dates[dates.length - 1] ?? endDate },
          endDate: { gte: dates[0] ?? startDate },
        },
      }),
    ]);
    const attendanceByDate = new Map(attendances.map((a) => [a.date.toISOString().slice(0, 10), a]));

    const summary: AttendanceSummary = { workingDays: dates.length, present: 0, absent: 0, leave: 0, pendingApproval: 0 };
    const dailyReport: DailyReportRow[] = [];

    for (const date of dates) {
      const key = date.toISOString().slice(0, 10);
      const onLeave = leaves.some((l) => l.startDate <= date && l.endDate >= date);
      const attendance = attendanceByDate.get(key);

      let status: DailyReportRow['status'];
      if (onLeave) {
        status = 'ON_LEAVE';
        summary.leave += 1;
      } else if (attendance && PRESENT_STATUSES.includes(attendance.status)) {
        status = attendance.status;
        summary.present += 1;
      } else if (attendance?.status === AttendanceStatus.PENDING_APPROVAL) {
        status = 'PENDING_APPROVAL';
        summary.pendingApproval += 1;
      } else if (attendance?.status === AttendanceStatus.HOLIDAY) {
        status = 'HOLIDAY';
      } else {
        status = attendance?.status === AttendanceStatus.REJECTED ? 'REJECTED' : 'ABSENT';
        summary.absent += 1;
      }

      if (withDailyRows) {
        dailyReport.push({
          date: key,
          day: date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
          status,
          attendanceId: attendance?.id ?? null,
          clockInAt: attendance?.clockInAt ?? null,
          clockOutAt: attendance?.clockOutAt ?? null,
          clockInLat: attendance?.clockInLat ?? null,
          clockInLng: attendance?.clockInLng ?? null,
        });
      }
    }

    return withDailyRows ? { summary, dailyReport: dailyReport.reverse() } : { summary };
  }
}
