import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { StudentLeaveStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileContextService } from '../common/mobile-context.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { CreateLeaveForStudentDto } from './dto/create-leave-for-student.dto';
import { BulkReviewLeavesDto } from './dto/bulk-review-leaves.dto';
import { GetLeavesQueryDto } from './dto/get-leaves-query.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { BulkManageLeavesDto } from './dto/bulk-manage-leaves.dto';

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateRange(fromStr: string, toStr: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${fromStr}T00:00:00.000Z`);
  const end = new Date(`${toStr}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(toDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function toLegacyStatus(status: StudentLeaveStatus): string {
  return status.toLowerCase();
}

function toEnumStatus(status: string): StudentLeaveStatus {
  return status.toUpperCase() as StudentLeaveStatus;
}

function serializeLeave(leave: {
  id: string;
  studentId: string;
  leaveDate: Date;
  reason: string;
  leaveType: string | null;
  status: StudentLeaveStatus;
  creationRemarks: string | null;
  approvalRemarks: string | null;
  createdById: string | null;
  approvedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: leave.id,
    student_id: leave.studentId,
    leave_date: toDateOnly(leave.leaveDate),
    reason: leave.reason,
    leave_type: leave.leaveType,
    status: toLegacyStatus(leave.status),
    creation_remarks: leave.creationRemarks,
    approval_remarks: leave.approvalRemarks,
    created_by: leave.createdById,
    approved_by: leave.approvedById,
    created_at: leave.createdAt.toISOString(),
    updated_at: leave.updatedAt.toISOString(),
  };
}

@Injectable()
export class MobileStudentLeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: MobileContextService,
  ) {}

  /** Legacy checks `role_user` for 'teacher'/'admin'; here: has a Teacher profile, or isn't a (pure) Student at all. */
  async isTeacherOrAdmin(userId: string): Promise<boolean> {
    const [teacher, student] = await Promise.all([
      this.prisma.teacher.findUnique({ where: { userId } }),
      this.prisma.student.findUnique({ where: { userId } }),
    ]);
    return !!teacher || !student;
  }

  private async assertNoConflict(
    branchId: string,
    studentId: string,
    dates: string[],
    excludeLeaveId?: string,
  ): Promise<void> {
    const existing = await this.prisma.studentLeave.findMany({
      where: {
        branchId,
        studentId,
        status: { in: [StudentLeaveStatus.PENDING, StudentLeaveStatus.APPROVED] },
        leaveDate: { in: dates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
        ...(excludeLeaveId && { id: { not: excludeLeaveId } }),
      },
      select: { leaveDate: true },
    });
    if (existing.length > 0) {
      const conflicting = existing.map((e) => toDateOnly(e.leaveDate));
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { date_range: `Conflict on dates: ${conflicting.join(', ')}` },
      });
    }
  }

  async applyLeave(branchId: string, userId: string, studentId: string, dto: ApplyLeaveDto) {
    const dates = dateRange(dto.from_date, dto.to_date);
    await this.assertNoConflict(branchId, studentId, dates);

    const created = await this.prisma.$transaction(
      dates.map((leaveDate) =>
        this.prisma.studentLeave.create({
          data: {
            branchId,
            studentId,
            leaveDate: new Date(`${leaveDate}T00:00:00.000Z`),
            reason: dto.reason,
            leaveType: dto.leave_type,
            status: StudentLeaveStatus.PENDING,
            creationRemarks: dto.creation_remarks,
            createdById: userId,
          },
        }),
      ),
    );

    return {
      message: `Leave application submitted successfully for ${created.length} day(s).`,
      from_date: dto.from_date,
      to_date: dto.to_date,
      data: created.map(serializeLeave),
    };
  }

  async createLeaveForStudent(branchId: string, userId: string, dto: CreateLeaveForStudentDto) {
    const student = await this.prisma.student.findFirst({ where: { id: dto.student_id, branchId } });
    if (!student) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: { student_id: 'The selected student id is invalid.' },
      });
    }

    const dates = dateRange(dto.from_date, dto.to_date);
    await this.assertNoConflict(branchId, dto.student_id, dates);

    const status = dto.status ?? 'pending';
    const roleNames = await this.context.getRoleNames(userId);

    const created = await this.prisma.$transaction(
      dates.map((leaveDate) =>
        this.prisma.studentLeave.create({
          data: {
            branchId,
            studentId: dto.student_id,
            leaveDate: new Date(`${leaveDate}T00:00:00.000Z`),
            reason: dto.reason,
            leaveType: dto.leave_type,
            status: toEnumStatus(status),
            creationRemarks: dto.creation_remarks,
            createdById: userId,
            approvedById: status === 'approved' ? userId : undefined,
            approvalRemarks: status === 'approved' ? `Approved by ${roleNames.join(',')}` : undefined,
          },
        }),
      ),
    );

    return {
      message: `Leave created successfully for student ID ${dto.student_id} for ${created.length} day(s).`,
      from_date: dto.from_date,
      to_date: dto.to_date,
      status,
      data: created.map(serializeLeave),
    };
  }

  async bulkReviewLeaves(branchId: string, userId: string, dto: BulkReviewLeavesDto) {
    const leaves = await this.prisma.studentLeave.findMany({
      where: { id: { in: dto.leave_ids }, branchId, status: StudentLeaveStatus.PENDING },
    });
    if (leaves.length === 0) {
      throw new UnprocessableEntityException({ message: 'None of the provided leave IDs are pending.' });
    }

    await this.prisma.studentLeave.updateMany({
      where: { id: { in: leaves.map((l) => l.id) } },
      data: {
        status: toEnumStatus(dto.action),
        approvedById: userId,
        approvalRemarks: dto.approval_remarks,
      },
    });

    return {
      message: `${leaves.length} leave request(s) ${dto.action}.`,
      updated_ids: leaves.map((l) => l.id),
    };
  }

  async getLeaves(branchId: string, userId: string, query: GetLeavesQueryDto) {
    const isStudent = !!(await this.prisma.student.findUnique({ where: { userId } }));
    const isTeacherOrAdmin = await this.isTeacherOrAdmin(userId);

    if (!isStudent && !isTeacherOrAdmin) {
      throw new ForbiddenException('Unauthorized.');
    }

    const ownStudentId = isStudent ? await this.context.resolveOwnStudentId(userId) : null;

    const where = {
      branchId,
      ...(ownStudentId && { studentId: ownStudentId }),
      ...(query.student_id && isTeacherOrAdmin && { studentId: query.student_id }),
      ...(query.status && { status: toEnumStatus(query.status) }),
      ...(query.leave_type && { leaveType: query.leave_type }),
      ...((query.from_date || query.to_date) && {
        leaveDate: {
          ...(query.from_date && { gte: new Date(`${query.from_date}T00:00:00.000Z`) }),
          ...(query.to_date && { lte: new Date(`${query.to_date}T00:00:00.000Z`) }),
        },
      }),
    };

    const perPage = query.per_page ? Number(query.per_page) : 15;
    const page = 1;

    const [total, leaves] = await Promise.all([
      this.prisma.studentLeave.count({ where }),
      this.prisma.studentLeave.findMany({
        where,
        orderBy: { leaveDate: 'desc' },
        take: perPage,
        skip: (page - 1) * perPage,
      }),
    ]);

    return {
      data: leaves.map(serializeLeave),
      meta: {
        current_page: page,
        per_page: perPage,
        total,
        last_page: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async findLeaveOrNull(branchId: string, leaveId: string) {
    return this.prisma.studentLeave.findFirst({ where: { id: leaveId, branchId } });
  }

  async updateLeave(branchId: string, userId: string, leaveId: string, dto: UpdateLeaveDto) {
    // Controller has already confirmed this leave exists in this branch.
    const leave = await this.prisma.studentLeave.findFirstOrThrow({ where: { id: leaveId, branchId } });

    const hasRangeChange = dto.from_date !== undefined && dto.to_date !== undefined;

    if (hasRangeChange) {
      const newDates = dateRange(dto.from_date!, dto.to_date!);
      await this.assertNoConflict(branchId, leave.studentId, newDates, leaveId);

      const [firstDate, ...extraDates] = newDates;
      const status = dto.status ?? toLegacyStatus(leave.status);
      const isApproved = dto.status === 'approved';

      const updated = await this.prisma.$transaction(async (tx) => {
        const updatedOriginal = await tx.studentLeave.update({
          where: { id: leaveId },
          data: {
            ...(dto.reason !== undefined && { reason: dto.reason }),
            ...(dto.leave_type !== undefined && { leaveType: dto.leave_type }),
            ...(dto.creation_remarks !== undefined && { creationRemarks: dto.creation_remarks }),
            leaveDate: new Date(`${firstDate}T00:00:00.000Z`),
            ...(dto.status !== undefined && { status: toEnumStatus(dto.status) }),
            ...(isApproved && { approvedById: userId, approvalRemarks: dto.approval_remarks ?? leave.approvalRemarks }),
          },
        });

        const extras: (typeof updatedOriginal)[] = [];
        for (const date of extraDates) {
          extras.push(
            await tx.studentLeave.create({
              data: {
                branchId,
                studentId: leave.studentId,
                leaveDate: new Date(`${date}T00:00:00.000Z`),
                reason: updatedOriginal.reason,
                leaveType: updatedOriginal.leaveType,
                status: updatedOriginal.status,
                creationRemarks: updatedOriginal.creationRemarks,
                createdById: leave.createdById,
                approvedById: updatedOriginal.approvedById,
                approvalRemarks: updatedOriginal.approvalRemarks,
              },
            }),
          );
        }

        return [updatedOriginal, ...extras];
      });

      return {
        message: `Leave updated successfully for ${updated.length} day(s).`,
        data: updated.map(serializeLeave),
      };
    }

    // Single-field update path (no full date-range change).
    const singleDate = dto.from_date ?? dto.to_date;
    const isApproved = dto.status === 'approved';
    const isRejected = dto.status === 'rejected';

    const updated = await this.prisma.studentLeave.update({
      where: { id: leaveId },
      data: {
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.leave_type !== undefined && { leaveType: dto.leave_type }),
        ...(dto.creation_remarks !== undefined && { creationRemarks: dto.creation_remarks }),
        ...(singleDate !== undefined && { leaveDate: new Date(`${singleDate}T00:00:00.000Z`) }),
        ...(dto.status !== undefined && { status: toEnumStatus(dto.status) }),
        ...((isApproved || isRejected) && {
          approvedById: userId,
          approvalRemarks: dto.approval_remarks ?? leave.approvalRemarks,
        }),
      },
    });

    return {
      message: 'Leave record updated successfully.',
      data: serializeLeave(updated),
    };
  }

  async bulkManageLeaves(branchId: string, userId: string, dto: BulkManageLeavesDto) {
    const updates = dto.updates ?? [];
    const deletes = dto.deletes ?? [];

    if (updates.length === 0 && deletes.length === 0) {
      throw new UnprocessableEntityException({
        message: 'At least one of "updates" or "deletes" must be provided.',
      });
    }

    const updatedIds = new Set<string>();
    const errors: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (let index = 0; index < updates.length; index++) {
        const item = updates[index];
        const leave = await tx.studentLeave.findFirst({ where: { id: item.id, branchId } });
        if (!leave) {
          errors.push(`Update item #${index}: Leave ID ${item.id} not found.`);
          continue;
        }

        const hasDateChange = item.from_date !== undefined;
        let newDates: string[] = [];
        if (hasDateChange) {
          newDates = dateRange(item.from_date!, item.to_date ?? item.from_date!);
          const existing = await tx.studentLeave.findMany({
            where: {
              branchId,
              studentId: leave.studentId,
              status: { in: [StudentLeaveStatus.PENDING, StudentLeaveStatus.APPROVED] },
              id: { not: item.id },
              leaveDate: { in: newDates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
            },
            select: { leaveDate: true },
          });
          if (existing.length > 0) {
            errors.push(
              `Update item #${index} (ID ${item.id}): Conflict on dates: ${existing.map((e) => toDateOnly(e.leaveDate)).join(', ')}`,
            );
            continue;
          }
        }

        const payload = {
          ...(item.reason !== undefined && { reason: item.reason }),
          ...(item.leave_type !== undefined && { leaveType: item.leave_type }),
          ...(item.creation_remarks !== undefined && { creationRemarks: item.creation_remarks }),
          ...(item.status !== undefined && {
            status: toEnumStatus(item.status),
            approvedById: userId,
            ...(item.approval_remarks !== undefined && { approvalRemarks: item.approval_remarks }),
          }),
          ...(item.status === undefined && item.approval_remarks !== undefined && { approvalRemarks: item.approval_remarks }),
        };

        if (hasDateChange) {
          const [firstDate, ...extraDates] = newDates;
          const updatedOriginal = await tx.studentLeave.update({
            where: { id: item.id },
            data: { ...payload, leaveDate: new Date(`${firstDate}T00:00:00.000Z`) },
          });
          for (const date of extraDates) {
            await tx.studentLeave.create({
              data: {
                branchId,
                studentId: leave.studentId,
                leaveDate: new Date(`${date}T00:00:00.000Z`),
                reason: updatedOriginal.reason,
                leaveType: updatedOriginal.leaveType,
                status: updatedOriginal.status,
                creationRemarks: updatedOriginal.creationRemarks,
                createdById: leave.createdById,
                approvedById: item.status !== undefined ? userId : updatedOriginal.approvedById,
                approvalRemarks: updatedOriginal.approvalRemarks,
              },
            });
          }
          updatedIds.add(item.id);
        } else if (Object.keys(payload).length > 0) {
          await tx.studentLeave.update({ where: { id: item.id }, data: payload });
          updatedIds.add(item.id);
        }
      }
    });

    let deletedIds: string[] = [];
    if (deletes.length > 0) {
      const toDelete = await this.prisma.studentLeave.findMany({
        where: { id: { in: deletes }, branchId },
        select: { id: true },
      });
      deletedIds = toDelete.map((d) => d.id);
      await this.prisma.studentLeave.deleteMany({ where: { id: { in: deletedIds } } });
    }

    const response: Record<string, unknown> = { message: 'Bulk operation completed.' };
    if (updatedIds.size > 0) {
      response.updated_count = updatedIds.size;
      response.updated_ids = [...updatedIds];
    }
    if (deletedIds.length > 0) {
      response.deleted_count = deletedIds.length;
      response.deleted_ids = deletedIds;
    }
    if (errors.length > 0) {
      response.errors = errors;
    }
    return response;
  }
}
