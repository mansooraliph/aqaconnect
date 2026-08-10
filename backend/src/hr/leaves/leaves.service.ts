import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';

const CANCELLABLE_STATUSES: LeaveStatus[] = [LeaveStatus.PENDING, LeaveStatus.PRE_APPROVED];
const APPROVABLE_STATUSES: LeaveStatus[] = [LeaveStatus.PENDING, LeaveStatus.PRE_APPROVED];

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  private includeClause() {
    return {
      employee: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    };
  }

  list(branchId: string, employeeId?: string, status?: LeaveStatus) {
    return this.prisma.leave.findMany({
      where: {
        branchId,
        ...(employeeId && { employeeId }),
        ...(status && { status }),
      },
      include: this.includeClause(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const leave = await this.prisma.leave.findFirst({
      where: { id, branchId },
      include: this.includeClause(),
    });
    if (!leave) {
      throw new NotFoundException('Leave not found');
    }
    return leave;
  }

  private async assertEmployeeBelongsToBranch(branchId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, branchId } });
    if (!employee) {
      throw new BadRequestException('employeeId must belong to this branch');
    }
  }

  async create(branchId: string, dto: CreateLeaveDto) {
    await this.assertEmployeeBelongsToBranch(branchId, dto.employeeId);
    return this.prisma.leave.create({
      data: {
        branchId,
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        leaveTypeId: dto.leaveTypeId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isHalfDay: dto.isHalfDay ?? false,
        reason: dto.reason,
        status: LeaveStatus.PENDING,
      },
      include: this.includeClause(),
    });
  }

  async approve(branchId: string, id: string, actorUserId: string, dto: ApproveLeaveDto) {
    const leave = await this.findOne(branchId, id);
    if (!APPROVABLE_STATUSES.includes(leave.status)) {
      throw new ConflictException('Only pending or pre-approved leaves can be approved');
    }
    return this.prisma.leave.update({
      where: { id },
      data: {
        status: LeaveStatus.APPROVED,
        approvedById: actorUserId,
        approvalNote: dto.approvalNote,
      },
      include: this.includeClause(),
    });
  }

  async reject(branchId: string, id: string, actorUserId: string, dto: RejectLeaveDto) {
    const leave = await this.findOne(branchId, id);
    if (!APPROVABLE_STATUSES.includes(leave.status)) {
      throw new ConflictException('Only pending or pre-approved leaves can be rejected');
    }
    return this.prisma.leave.update({
      where: { id },
      data: {
        status: LeaveStatus.REJECTED,
        approvedById: actorUserId,
        approvalNote: dto.approvalNote,
      },
      include: this.includeClause(),
    });
  }

  /** Self-service: the applicant withdrawing their own not-yet-final request. */
  async cancel(branchId: string, id: string) {
    const leave = await this.findOne(branchId, id);
    if (!CANCELLABLE_STATUSES.includes(leave.status)) {
      throw new ConflictException('Only pending or pre-approved leaves can be cancelled');
    }
    return this.prisma.leave.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
      include: this.includeClause(),
    });
  }
}
