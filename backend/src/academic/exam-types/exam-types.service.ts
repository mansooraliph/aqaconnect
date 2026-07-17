import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamTypeDto } from './dto/create-exam-type.dto';
import { UpdateExamTypeDto } from './dto/update-exam-type.dto';

@Injectable()
export class ExamTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.examType.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.examType.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Exam type not found');
    }
    return record;
  }

  create(branchId: string, dto: CreateExamTypeDto) {
    return this.prisma.examType.create({ data: { branchId, name: dto.name } });
  }

  async update(branchId: string, id: string, dto: UpdateExamTypeDto) {
    await this.findOne(branchId, id);
    return this.prisma.examType.update({ where: { id }, data: dto });
  }
}
