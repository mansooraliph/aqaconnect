import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAcademicSectionDto } from './dto/create-academic-section.dto';
import { UpdateAcademicSectionDto } from './dto/update-academic-section.dto';

@Injectable()
export class AcademicSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.academicSection.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.academicSection.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Academic section not found');
    }
    return record;
  }

  create(branchId: string, dto: CreateAcademicSectionDto) {
    return this.prisma.academicSection.create({ data: { branchId, name: dto.name } });
  }

  async update(branchId: string, id: string, dto: UpdateAcademicSectionDto) {
    await this.findOne(branchId, id);
    return this.prisma.academicSection.update({ where: { id }, data: dto });
  }
}
