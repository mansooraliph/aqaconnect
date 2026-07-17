import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateClassSectionYearsDto } from './dto/generate.dto';
import { UpdateClassSectionYearDto } from './dto/update-class-section-year.dto';

@Injectable()
export class AcademicClassSectionYearsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string, academicYearId?: string) {
    return this.prisma.academicClassSectionYear.findMany({
      where: {
        academicClassSection: { academicClass: { branchId } },
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicClassSection: { include: { academicClass: true, academicSection: true } },
        academicYear: true,
      },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.academicClassSectionYear.findFirst({
      where: { id, academicClassSection: { academicClass: { branchId } } },
      include: {
        academicClassSection: { include: { academicClass: true, academicSection: true } },
        academicYear: true,
      },
    });
    if (!record) {
      throw new NotFoundException('Class section year not found');
    }
    return record;
  }

  private async classSectionsMissingYear(branchId: string, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, branchId },
    });
    if (!year) {
      throw new BadRequestException('academicYearId must belong to this branch');
    }

    const classSections = await this.prisma.academicClassSection.findMany({
      where: { academicClass: { branchId } },
      include: {
        academicClass: true,
        academicSection: true,
        classSectionYears: { where: { academicYearId } },
      },
    });

    return classSections.filter((cs) => cs.classSectionYears.length === 0);
  }

  /** Dry-run: shows what generation WOULD create, without writing anything. */
  async previewGeneration(branchId: string, dto: GenerateClassSectionYearsDto) {
    const missing = await this.classSectionsMissingYear(branchId, dto.academicYearId);
    return missing.map((cs) => ({
      academicClassSectionId: cs.id,
      className: cs.academicClass.name,
      sectionName: cs.academicSection.name,
      proposedCapacity: cs.capacity,
    }));
  }

  /** Idempotent: only creates rows for class-sections that don't already have one for this year. */
  async generate(branchId: string, dto: GenerateClassSectionYearsDto) {
    const missing = await this.classSectionsMissingYear(branchId, dto.academicYearId);
    if (missing.length === 0) {
      return { created: 0, items: [] };
    }
    const created = await this.prisma.$transaction(
      missing.map((cs) =>
        this.prisma.academicClassSectionYear.create({
          data: {
            academicClassSectionId: cs.id,
            academicYearId: dto.academicYearId,
            capacity: cs.capacity,
          },
        }),
      ),
    );
    return { created: created.length, items: created };
  }

  async update(branchId: string, id: string, dto: UpdateClassSectionYearDto) {
    await this.findOne(branchId, id);
    return this.prisma.academicClassSectionYear.update({ where: { id }, data: dto });
  }
}
