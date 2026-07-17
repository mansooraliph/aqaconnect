import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveQuotaDto } from './dto/create-leave-quota.dto';
import { UpdateLeaveQuotaDto } from './dto/update-leave-quota.dto';

@Injectable()
export class LeaveQuotasService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string, employeeId?: string) {
    return this.prisma.leaveQuota.findMany({
      where: {
        employee: { branchId },
        ...(employeeId && { employeeId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const quota = await this.prisma.leaveQuota.findFirst({
      where: { id, employee: { branchId } },
    });
    if (!quota) {
      throw new NotFoundException('Leave quota not found');
    }
    return quota;
  }

  private async assertEmployeeBelongsToBranch(branchId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, branchId } });
    if (!employee) {
      throw new BadRequestException('employeeId must belong to this branch');
    }
  }

  /**
   * `LeaveQuota.academicYearId` is nullable, so the schema's
   * `@@unique([employeeId, leaveType, academicYearId])` does NOT actually
   * prevent duplicate rows when academicYearId is null — Postgres treats
   * every NULL as distinct in a unique index. This is documented as a known,
   * already-accepted caveat in the schema comment above the LeaveQuota model
   * (same class of issue as FeeDemand/UserRole), not something fixed here.
   * A plain Prisma `upsert` on that compound key isn't reliable as a result,
   * so we find-then-create instead, mirroring UsersService.assignRole.
   */
  async create(branchId: string, dto: CreateLeaveQuotaDto) {
    await this.assertEmployeeBelongsToBranch(branchId, dto.employeeId);
    return this.prisma.leaveQuota.create({
      data: {
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        academicYearId: dto.academicYearId,
        totalDays: dto.totalDays,
      },
    });
  }

  async update(branchId: string, id: string, dto: UpdateLeaveQuotaDto) {
    await this.findOne(branchId, id);
    return this.prisma.leaveQuota.update({
      where: { id },
      data: {
        ...(dto.totalDays !== undefined && { totalDays: dto.totalDays }),
        ...(dto.usedDays !== undefined && { usedDays: dto.usedDays }),
      },
    });
  }
}
