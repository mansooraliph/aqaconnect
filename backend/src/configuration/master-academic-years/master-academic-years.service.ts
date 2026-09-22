import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMasterAcademicYearDto } from './dto/create-master-academic-year.dto';
import { UpdateMasterAcademicYearDto } from './dto/update-master-academic-year.dto';
import { PublishMasterAcademicYearDto } from './dto/publish-master-academic-year.dto';

/**
 * Super Admin's single, branch-less common academic year. Mirrors
 * AcademicYearsService's create/update (name/dates only — isCurrent is a
 * per-branch concept, never touched here), plus `publish()` to copy a year
 * out to branches.
 */
@Injectable()
export class MasterAcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.masterAcademicYear.findMany({ orderBy: { startDate: 'desc' } });
  }

  async findOne(id: string) {
    const year = await this.prisma.masterAcademicYear.findUnique({ where: { id } });
    if (!year) {
      throw new NotFoundException('Master academic year not found');
    }
    return year;
  }

  create(dto: CreateMasterAcademicYearDto) {
    return this.prisma.masterAcademicYear.create({
      data: { name: dto.name, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) },
    });
  }

  async update(id: string, dto: UpdateMasterAcademicYearDto) {
    await this.findOne(id);
    return this.prisma.masterAcademicYear.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      },
    });
  }

  /**
   * Copies this master year's name/dates into every target branch's own
   * AcademicYear. A branch year that's already isCustomized=true (created or
   * edited by that branch) is never touched — publish only fills gaps and
   * syncs years the branch hasn't customized. Matches an existing branch row
   * by masterAcademicYearId first, falling back to name (so a branch that
   * already independently created a same-named year gets linked/protected
   * correctly instead of getting a duplicate). Never sets isCurrent — that
   * stays a purely per-branch decision via AcademicYearsService.makeCurrent.
   */
  async publish(id: string, dto: PublishMasterAcademicYearDto) {
    const master = await this.findOne(id);

    const branches = await this.prisma.branch.findMany({
      where: { isActive: true, ...(dto.branchIds && { id: { in: dto.branchIds } }) },
      select: { id: true },
    });

    const summaries: { branchId: string; created: number; updated: number; skipped: number }[] = [];

    for (const branch of branches) {
      const existing = await this.prisma.academicYear.findFirst({
        where: { branchId: branch.id, OR: [{ masterAcademicYearId: master.id }, { name: master.name }] },
      });

      const fields = { name: master.name, startDate: master.startDate, endDate: master.endDate, masterAcademicYearId: master.id };

      if (!existing) {
        await this.prisma.academicYear.create({
          data: { branchId: branch.id, ...fields, isCustomized: false },
        });
        summaries.push({ branchId: branch.id, created: 1, updated: 0, skipped: 0 });
      } else if (!existing.isCustomized) {
        await this.prisma.academicYear.update({ where: { id: existing.id }, data: fields });
        summaries.push({ branchId: branch.id, created: 0, updated: 1, skipped: 0 });
      } else {
        summaries.push({ branchId: branch.id, created: 0, updated: 0, skipped: 1 });
      }
    }

    return { masterAcademicYearId: master.id, branches: summaries };
  }
}
