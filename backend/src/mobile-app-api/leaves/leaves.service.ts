import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LeavesService } from '../../hr/leaves/leaves.service';
import { LeaveQuotasService } from '../../hr/leaves/leave-quotas.service';
import { MobileContextService } from '../common/mobile-context.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { MobileRejectLeaveDto } from './dto/reject-leave.dto';

@Injectable()
export class MobileLeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaves: LeavesService,
    private readonly leaveQuotas: LeaveQuotasService,
    private readonly context: MobileContextService,
  ) {}

  listTypes(branchId: string) {
    return this.prisma.leaveType.findMany({ where: { branchId, status: 'ACTIVE' }, orderBy: { name: 'asc' } });
  }

  async approvals(branchId: string) {
    const [pending, completed] = await Promise.all([
      this.leaves.list(branchId, undefined, LeaveStatus.PENDING),
      this.leaves.list(branchId, undefined, LeaveStatus.APPROVED),
    ]);
    return { pending, completed };
  }

  async myLeaves(branchId: string, userId: string) {
    const employeeId = await this.context.resolveOwnEmployeeId(branchId, userId);
    const [leaves, quotas] = await Promise.all([
      this.leaves.list(branchId, employeeId),
      this.leaveQuotas.list(branchId, employeeId),
    ]);
    const leaveTypeIds = [...new Set(quotas.map((q) => q.leaveTypeId).filter((id): id is string => Boolean(id)))];
    const leaveTypes = leaveTypeIds.length
      ? await this.prisma.leaveType.findMany({ where: { id: { in: leaveTypeIds } } })
      : [];
    const leaveTypeNameById = new Map(leaveTypes.map((t) => [t.id, t.name]));

    const leaveSummary = quotas.map((quota) => ({
      leaveTypeId: quota.leaveTypeId,
      leaveTypeName: quota.leaveTypeId ? leaveTypeNameById.get(quota.leaveTypeId) ?? quota.leaveType : quota.leaveType,
      allocated: quota.totalDays,
      taken: quota.usedDays,
      remaining: Number(quota.totalDays) - Number(quota.usedDays),
    }));

    return { totalLeaves: leaves.length, leaves, leaveSummary };
  }

  async applyLeave(branchId: string, userId: string, dto: ApplyLeaveDto) {
    const employeeId = await this.context.resolveOwnEmployeeId(branchId, userId);
    const leaveType = await this.prisma.leaveType.findFirst({ where: { id: dto.type, branchId } });
    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }
    return this.leaves.create(branchId, {
      employeeId,
      leaveType: leaveType.name,
      leaveTypeId: leaveType.id,
      startDate: dto.start_date,
      endDate: dto.end_date,
      isHalfDay: dto.is_half_day,
      reason: dto.reason,
    });
  }

  async approveLeave(branchId: string, userId: string, leaveId: string) {
    return this.leaves.approve(branchId, leaveId, userId, {});
  }

  async rejectLeave(branchId: string, userId: string, leaveId: string, dto: MobileRejectLeaveDto) {
    return this.leaves.reject(branchId, leaveId, userId, {
      approvalNote: dto.rejection_reason ?? 'Rejected via mobile app',
    });
  }

  async cancelLeave(branchId: string, userId: string, leaveId: string) {
    const employeeId = await this.context.resolveOwnEmployeeId(branchId, userId);
    const leave = await this.leaves.findOne(branchId, leaveId);
    if (leave.employeeId !== employeeId) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }
    return this.leaves.cancel(branchId, leaveId);
  }
}
