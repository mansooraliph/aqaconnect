import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string, examTypeId?: string) {
    return this.prisma.exam.findMany({
      where: { branchId, ...(examTypeId && { examTypeId }) },
      include: { examType: { select: { name: true } } },
      orderBy: { examDate: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.exam.findFirst({
      where: { id, branchId },
      include: { examType: { select: { name: true } } },
    });
    if (!record) {
      throw new NotFoundException('Exam not found');
    }
    return record;
  }

  private async assertExamTypeBelongsToBranch(branchId: string, examTypeId: string) {
    const examType = await this.prisma.examType.findFirst({ where: { id: examTypeId, branchId } });
    if (!examType) {
      throw new BadRequestException('examTypeId must belong to this branch');
    }
  }

  async create(branchId: string, dto: CreateExamDto) {
    await this.assertExamTypeBelongsToBranch(branchId, dto.examTypeId);
    return this.prisma.exam.create({
      data: {
        branchId,
        examTypeId: dto.examTypeId,
        name: dto.name,
        examDate: new Date(dto.examDate),
        ...(dto.maxMarks !== undefined && { maxMarks: dto.maxMarks }),
      },
      include: { examType: { select: { name: true } } },
    });
  }

  async update(branchId: string, id: string, dto: UpdateExamDto) {
    await this.findOne(branchId, id);
    return this.prisma.exam.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.examDate !== undefined && { examDate: new Date(dto.examDate) }),
        ...(dto.maxMarks !== undefined && { maxMarks: dto.maxMarks }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { examType: { select: { name: true } } },
    });
  }
}
