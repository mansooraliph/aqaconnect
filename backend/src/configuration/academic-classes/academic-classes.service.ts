import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAcademicClassDto } from './dto/create-academic-class.dto';
import { UpdateAcademicClassDto } from './dto/update-academic-class.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';

@Injectable()
export class AcademicClassesService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.academicClass.findMany({
      where: { branchId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.academicClass.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Academic class not found');
    }
    return record;
  }

  create(branchId: string, dto: CreateAcademicClassDto) {
    return this.prisma.academicClass.create({
      data: { branchId, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async update(branchId: string, id: string, dto: UpdateAcademicClassDto) {
    await this.findOne(branchId, id);
    return this.prisma.academicClass.update({ where: { id }, data: dto });
  }

  async bulkAction(branchId: string, dto: BulkActionDto) {
    const where = { branchId, id: { in: dto.ids } };
    if (dto.action === 'delete') {
      return this.prisma.academicClass.deleteMany({ where });
    }
    return this.prisma.academicClass.updateMany({
      where,
      data: { status: dto.action === 'activate' ? 'ACTIVE' : 'INACTIVE' },
    });
  }
}
