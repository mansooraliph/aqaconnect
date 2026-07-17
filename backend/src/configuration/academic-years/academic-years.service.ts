import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.academicYear.findMany({
      where: { branchId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const year = await this.prisma.academicYear.findFirst({ where: { id, branchId } });
    if (!year) {
      throw new NotFoundException('Academic year not found');
    }
    return year;
  }

  create(branchId: string, dto: CreateAcademicYearDto) {
    return this.prisma.academicYear.create({
      data: {
        branchId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async update(branchId: string, id: string, dto: UpdateAcademicYearDto) {
    await this.findOne(branchId, id);
    return this.prisma.academicYear.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      },
    });
  }

  /** Only one AcademicYear may be "current" per branch. */
  async makeCurrent(branchId: string, id: string) {
    await this.findOne(branchId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { branchId, isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.academicYear.update({
        where: { id },
        data: { isCurrent: true },
      });
    });
  }
}
