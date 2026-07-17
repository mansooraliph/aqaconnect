import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateBranchSettingsDto } from './dto/update-branch-settings.dto';

@Injectable()
export class BranchSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(branchId: string) {
    const existing = await this.prisma.branchSettings.findUnique({ where: { branchId } });
    if (existing) {
      return existing;
    }
    return this.prisma.branchSettings.create({ data: { branchId } });
  }

  private async assertAcademicYearBelongsToBranch(branchId: string, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, branchId } });
    if (!year) {
      throw new BadRequestException('academicYearId must belong to this branch');
    }
  }

  async update(branchId: string, dto: UpdateBranchSettingsDto) {
    if (dto.academicYearId) {
      await this.assertAcademicYearBelongsToBranch(branchId, dto.academicYearId);
    }
    await this.findOne(branchId);
    return this.prisma.branchSettings.update({ where: { branchId }, data: dto });
  }
}
