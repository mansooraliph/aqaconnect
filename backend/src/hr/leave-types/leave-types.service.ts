import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';

@Injectable()
export class LeaveTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.leaveType.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.leaveType.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Leave type not found');
    }
    return record;
  }

  create(branchId: string, dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({
      data: { branchId, name: dto.name, defaultDays: dto.defaultDays },
    });
  }

  async update(branchId: string, id: string, dto: UpdateLeaveTypeDto) {
    await this.findOne(branchId, id);
    return this.prisma.leaveType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultDays !== undefined && { defaultDays: dto.defaultDays }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }
}
