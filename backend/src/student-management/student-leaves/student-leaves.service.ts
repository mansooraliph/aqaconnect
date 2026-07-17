import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StudentLeaveStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentLeaveDto } from './dto/create-student-leave.dto';
import { ApproveStudentLeaveDto } from './dto/approve-student-leave.dto';
import { RejectStudentLeaveDto } from './dto/reject-student-leave.dto';
import { BulkManageStudentLeavesDto } from './dto/bulk-manage-student-leaves.dto';

const APPROVABLE_STATUSES: StudentLeaveStatus[] = [StudentLeaveStatus.PENDING];

@Injectable()
export class StudentLeavesService {
  constructor(private readonly prisma: PrismaService) {}

  private includeClause() {
    return {
      student: {
        select: { id: true, firstName: true, lastName: true, studentCode: true },
      },
    };
  }

  list(branchId: string, studentId?: string, status?: StudentLeaveStatus, fromDate?: string, toDate?: string) {
    return this.prisma.studentLeave.findMany({
      where: {
        branchId,
        ...(studentId && { studentId }),
        ...(status && { status }),
        ...((fromDate || toDate) && {
          leaveDate: {
            ...(fromDate && { gte: new Date(fromDate) }),
            ...(toDate && { lte: new Date(toDate) }),
          },
        }),
      },
      include: this.includeClause(),
      orderBy: { leaveDate: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const leave = await this.prisma.studentLeave.findFirst({
      where: { id, branchId },
      include: this.includeClause(),
    });
    if (!leave) {
      throw new NotFoundException('Student leave not found');
    }
    return leave;
  }

  private async assertStudentBelongsToBranch(branchId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, branchId } });
    if (!student) {
      throw new BadRequestException('studentId must belong to this branch');
    }
  }

  private buildDateRange(startDate: string, endDate: string): Date[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('startDate/endDate must be valid dates');
    }
    if (start > end) {
      throw new BadRequestException('startDate must not be after endDate');
    }
    const dates: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  /**
   * Mirrors the old system's applyLeave behavior: the caller submits a date
   * range, but one StudentLeave row is created per calendar day in that range.
   */
  async create(branchId: string, actorUserId: string, dto: CreateStudentLeaveDto) {
    await this.assertStudentBelongsToBranch(branchId, dto.studentId);
    const dates = this.buildDateRange(dto.startDate, dto.endDate);

    return this.prisma.$transaction(
      dates.map((leaveDate) =>
        this.prisma.studentLeave.create({
          data: {
            branchId,
            studentId: dto.studentId,
            leaveDate,
            reason: dto.reason,
            leaveType: dto.leaveType,
            creationRemarks: dto.creationRemarks,
            status: StudentLeaveStatus.PENDING,
            createdById: actorUserId,
          },
          include: this.includeClause(),
        }),
      ),
    );
  }

  async approve(branchId: string, id: string, actorUserId: string, dto: ApproveStudentLeaveDto) {
    const leave = await this.findOne(branchId, id);
    if (!APPROVABLE_STATUSES.includes(leave.status)) {
      throw new ConflictException('Only pending student leaves can be approved');
    }
    return this.prisma.studentLeave.update({
      where: { id },
      data: {
        status: StudentLeaveStatus.APPROVED,
        approvedById: actorUserId,
        approvalRemarks: dto.approvalRemarks,
      },
      include: this.includeClause(),
    });
  }

  async reject(branchId: string, id: string, actorUserId: string, dto: RejectStudentLeaveDto) {
    const leave = await this.findOne(branchId, id);
    if (!APPROVABLE_STATUSES.includes(leave.status)) {
      throw new ConflictException('Only pending student leaves can be rejected');
    }
    return this.prisma.studentLeave.update({
      where: { id },
      data: {
        status: StudentLeaveStatus.REJECTED,
        approvedById: actorUserId,
        approvalRemarks: dto.approvalRemarks,
      },
      include: this.includeClause(),
    });
  }

  /**
   * Mirrors the old system's bulkManageLeaves: applies the requested
   * transition to each id, skipping (not throwing on) any id that isn't
   * currently PENDING so one bad item doesn't abort the whole batch.
   */
  async bulkManage(branchId: string, actorUserId: string, dto: BulkManageStudentLeavesDto) {
    const skipped: string[] = [];
    let updated = 0;

    for (const id of dto.ids) {
      const leave = await this.prisma.studentLeave.findFirst({ where: { id, branchId } });
      if (!leave || !APPROVABLE_STATUSES.includes(leave.status)) {
        skipped.push(id);
        continue;
      }

      await this.prisma.studentLeave.update({
        where: { id },
        data: {
          status: dto.action === 'approve' ? StudentLeaveStatus.APPROVED : StudentLeaveStatus.REJECTED,
          approvedById: actorUserId,
          approvalRemarks: dto.approvalRemarks,
        },
      });
      updated += 1;
    }

    return { updated, skipped };
  }
}
