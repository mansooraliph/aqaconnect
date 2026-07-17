import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';

@Injectable()
export class AcademicClassSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.academicClassSection.findMany({
      where: { academicClass: { branchId } },
      include: { academicClass: true, academicSection: true },
      orderBy: [{ academicClass: { sortOrder: 'asc' } }, { academicSection: { name: 'asc' } }],
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.academicClassSection.findFirst({
      where: { id, academicClass: { branchId } },
      include: { academicClass: true, academicSection: true },
    });
    if (!record) {
      throw new NotFoundException('Class section not found');
    }
    return record;
  }

  private async assertBelongsToBranch(branchId: string, academicClassId: string, academicSectionId: string) {
    const [cls, section] = await Promise.all([
      this.prisma.academicClass.findFirst({ where: { id: academicClassId, branchId } }),
      this.prisma.academicSection.findFirst({ where: { id: academicSectionId, branchId } }),
    ]);
    if (!cls || !section) {
      throw new BadRequestException('academicClassId/academicSectionId must belong to this branch');
    }
  }

  async create(branchId: string, dto: CreateClassSectionDto) {
    await this.assertBelongsToBranch(branchId, dto.academicClassId, dto.academicSectionId);
    return this.prisma.academicClassSection.create({
      data: {
        academicClassId: dto.academicClassId,
        academicSectionId: dto.academicSectionId,
        capacity: dto.capacity,
      },
    });
  }

  async update(branchId: string, id: string, dto: UpdateClassSectionDto) {
    await this.findOne(branchId, id);
    return this.prisma.academicClassSection.update({ where: { id }, data: dto });
  }
}
