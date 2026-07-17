import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHalqaDto } from './dto/create-halqa.dto';
import { UpdateHalqaDto } from './dto/update-halqa.dto';
import { AssignStudentDto } from './dto/assign-student.dto';
import { RemoveStudentDto } from './dto/remove-student.dto';

const HALQA_INCLUDE = {
  teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
  students: {
    where: { removedAt: null },
    include: { student: { select: { id: true, firstName: true, lastName: true, studentCode: true } } },
  },
} as const;

@Injectable()
export class HalqasService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.halqa.findMany({
      where: { branchId },
      include: HALQA_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.halqa.findFirst({
      where: { id, branchId },
      include: HALQA_INCLUDE,
    });
    if (!record) {
      throw new NotFoundException('Halqa not found');
    }
    return record;
  }

  private async assertTeacherBelongsToBranch(branchId: string, teacherId: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id: teacherId, branchId } });
    if (!teacher) {
      throw new BadRequestException('teacherId must belong to this branch');
    }
  }

  async create(branchId: string, dto: CreateHalqaDto) {
    if (dto.teacherId) {
      await this.assertTeacherBelongsToBranch(branchId, dto.teacherId);
    }
    return this.prisma.halqa.create({
      data: {
        branchId,
        name: dto.name,
        teacherId: dto.teacherId,
      },
      include: HALQA_INCLUDE,
    });
  }

  async update(branchId: string, id: string, dto: UpdateHalqaDto) {
    await this.findOne(branchId, id);
    if (dto.teacherId) {
      await this.assertTeacherBelongsToBranch(branchId, dto.teacherId);
    }
    return this.prisma.halqa.update({
      where: { id },
      data: dto,
      include: HALQA_INCLUDE,
    });
  }

  private async assertStudentBelongsToBranch(branchId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, branchId } });
    if (!student) {
      throw new BadRequestException('studentId must belong to this branch');
    }
  }

  async assignStudent(branchId: string, halqaId: string, dto: AssignStudentDto) {
    await this.findOne(branchId, halqaId);
    await this.assertStudentBelongsToBranch(branchId, dto.studentId);

    const existing = await this.prisma.halqaStudent.findUnique({
      where: { halqaId_studentId: { halqaId, studentId: dto.studentId } },
    });

    if (existing) {
      if (existing.removedAt === null) {
        throw new ConflictException('Student is already assigned to this Halqa');
      }
      return this.prisma.halqaStudent.update({
        where: { id: existing.id },
        data: { removedAt: null, assignedAt: new Date() },
      });
    }

    return this.prisma.halqaStudent.create({
      data: {
        halqaId,
        studentId: dto.studentId,
      },
    });
  }

  async removeStudent(branchId: string, halqaId: string, dto: RemoveStudentDto) {
    await this.findOne(branchId, halqaId);

    const existing = await this.prisma.halqaStudent.findFirst({
      where: { halqaId, studentId: dto.studentId, removedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('No active assignment found for this student in this Halqa');
    }

    return this.prisma.halqaStudent.update({
      where: { id: existing.id },
      data: { removedAt: new Date() },
    });
  }

  async unassignedStudents(branchId: string, halqaId: string) {
    await this.findOne(branchId, halqaId);

    return this.prisma.student.findMany({
      where: {
        branchId,
        halqaMemberships: {
          none: { removedAt: null },
        },
      },
      select: { id: true, firstName: true, lastName: true, studentCode: true },
      orderBy: { firstName: 'asc' },
    });
  }
}
