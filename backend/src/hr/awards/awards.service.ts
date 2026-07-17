import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAwardDto } from './dto/create-award.dto';
import { UpdateAwardDto } from './dto/update-award.dto';

@Injectable()
export class AwardsService {
  constructor(private readonly prisma: PrismaService) {}

  private includeClause() {
    return {
      employee: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    };
  }

  private async assertEmployeeBelongsToBranch(branchId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, branchId } });
    if (!employee) {
      throw new BadRequestException('employeeId must belong to this branch');
    }
  }

  list(branchId: string, employeeId?: string) {
    return this.prisma.award.findMany({
      where: { branchId, ...(employeeId && { employeeId }) },
      include: this.includeClause(),
      orderBy: { awardedAt: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.award.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Award not found');
    }
    return record;
  }

  async create(branchId: string, dto: CreateAwardDto) {
    await this.assertEmployeeBelongsToBranch(branchId, dto.employeeId);
    return this.prisma.award.create({
      data: {
        branchId,
        employeeId: dto.employeeId,
        title: dto.title,
        description: dto.description,
        awardedAt: new Date(),
      },
      include: this.includeClause(),
    });
  }

  async update(branchId: string, id: string, dto: UpdateAwardDto) {
    await this.findOne(branchId, id);
    return this.prisma.award.update({
      where: { id },
      data: { status: dto.status },
      include: this.includeClause(),
    });
  }
}
