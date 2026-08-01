import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockInDto } from './dto/clock-in.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { toCsv } from '../../common/csv/csv.util';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // Same UTC month-range pattern as CalendarDaysService.monthRange, reused
  // here for consistency across HR/Configuration date-filtered lists.
  private monthRange(month?: number, year?: number) {
    if (month === undefined || year === undefined) {
      return undefined;
    }
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { gte: start, lt: end };
  }

  /** UTC date-only, matching the `@db.Date` column (no time component). */
  private dateOnly(input?: string | Date) {
    const source = input ? new Date(input) : new Date();
    return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  }

  private async assertEmployeeBelongsToBranch(branchId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, branchId } });
    if (!employee) {
      throw new BadRequestException('employeeId must belong to this branch');
    }
  }

  /**
   * Resolves the caller's OWN Employee record in this branch — clock-in/out
   * must never trust a client-supplied employeeId (that was the gap flagged
   * during Phase 2.2's build: any holder of `hr.attendance.view` could
   * otherwise clock in/out on behalf of anyone). Self-service only.
   */
  private async resolveOwnEmployeeId(branchId: string, userId: string): Promise<string> {
    const employee = await this.prisma.employee.findFirst({ where: { branchId, userId } });
    if (!employee) {
      throw new NotFoundException('No employee record linked to your account in this branch');
    }
    return employee.id;
  }

  list(branchId: string, employeeId?: string, date?: string, month?: number, year?: number) {
    const dateFilter = date ? this.dateOnly(date) : this.monthRange(month, year);
    return this.prisma.attendance.findMany({
      where: {
        branchId,
        ...(employeeId && { employeeId }),
        ...(dateFilter && { date: dateFilter }),
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Same filters as `list`, plus department/designation dimensions (joined
   * through Employee) — matching the old system's Attendance export, which
   * supported filtering by department/designation/year/month.
   */
  async exportCsv(
    branchId: string,
    employeeId?: string,
    date?: string,
    month?: number,
    year?: number,
    departmentId?: string,
    designationId?: string,
  ): Promise<string> {
    const dateFilter = date ? this.dateOnly(date) : this.monthRange(month, year);
    const records = await this.prisma.attendance.findMany({
      where: {
        branchId,
        employeeId: { not: null },
        ...(employeeId && { employeeId }),
        ...(dateFilter && { date: dateFilter }),
        ...((departmentId || designationId) && {
          employee: {
            ...(departmentId && { departmentId }),
            ...(designationId && { designationId }),
          },
        }),
      },
      include: {
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: true,
            designation: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const rows = records.map((record) => ({
      // `employeeId: { not: null }` in the query above guarantees this join is present.
      employeeName: `${record.employee!.user.firstName} ${record.employee!.user.lastName}`,
      email: record.employee!.user.email,
      department: record.employee!.department?.name ?? '',
      designation: record.employee!.designation?.name ?? '',
      date: record.date.toISOString().slice(0, 10),
      status: record.status,
      clockInAt: record.clockInAt ? record.clockInAt.toISOString() : '',
      clockOutAt: record.clockOutAt ? record.clockOutAt.toISOString() : '',
      remark: record.remark ?? '',
    }));

    return toCsv(rows, [
      { key: 'employeeName', header: 'Employee Name' },
      { key: 'email', header: 'Email' },
      { key: 'department', header: 'Department' },
      { key: 'designation', header: 'Designation' },
      { key: 'date', header: 'Date' },
      { key: 'status', header: 'Status' },
      { key: 'clockInAt', header: 'Clock In' },
      { key: 'clockOutAt', header: 'Clock Out' },
      { key: 'remark', header: 'Remark' },
    ]);
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.attendance.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }
    return record;
  }

  /**
   * `[employeeId, date]` has no nullable column involved (unlike LeaveQuota's
   * compound unique), so a real Prisma `upsert` on that key is safe here.
   */
  async clockIn(branchId: string, userId: string, dto: ClockInDto) {
    const employeeId = await this.resolveOwnEmployeeId(branchId, userId);
    const today = this.dateOnly();
    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      create: {
        branchId,
        employeeId,
        date: today,
        status: AttendanceStatus.PRESENT,
        clockInAt: new Date(),
        clockInLat: dto.lat,
        clockInLng: dto.lng,
      },
      update: {
        clockInAt: new Date(),
        clockInLat: dto.lat,
        clockInLng: dto.lng,
      },
    });
  }

  async clockOut(branchId: string, userId: string) {
    const employeeId = await this.resolveOwnEmployeeId(branchId, userId);
    const today = this.dateOnly();
    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (!existing || existing.branchId !== branchId) {
      throw new NotFoundException('No clock-in found for today');
    }
    return this.prisma.attendance.update({
      where: { id: existing.id },
      data: { clockOutAt: new Date() },
    });
  }

  async update(branchId: string, id: string, dto: UpdateAttendanceDto) {
    await this.findOne(branchId, id);
    return this.prisma.attendance.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
      },
    });
  }

  /**
   * Loop + Promise.all of independent per-employee upserts (rather than a
   * single $transaction array): each row is unrelated to the others, so
   * there's no atomicity requirement across the whole batch.
   */
  async bulkMark(branchId: string, dto: BulkMarkAttendanceDto) {
    const date = this.dateOnly(dto.date);
    return Promise.all(
      dto.employeeIds.map((employeeId) =>
        this.prisma.attendance.upsert({
          where: { employeeId_date: { employeeId, date } },
          create: { branchId, employeeId, date, status: dto.status },
          update: { status: dto.status },
        }),
      ),
    );
  }
}
