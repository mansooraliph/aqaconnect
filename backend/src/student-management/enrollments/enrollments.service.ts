import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { TransferEnrollmentDto } from './dto/transfer-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { toCsv } from '../../common/csv/csv.util';

const ENROLLMENT_INCLUDE = {
  student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
  academicClassSectionYear: {
    include: {
      academicClassSection: { include: { academicClass: true, academicSection: true } },
      academicYear: true,
    },
  },
} as const;

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string, query: QueryEnrollmentDto) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        student: { branchId },
        ...(query.studentId && { studentId: query.studentId }),
        ...(query.academicClassSectionYearId && {
          academicClassSectionYearId: query.academicClassSectionYearId,
        }),
        ...(query.status && { status: query.status }),
      },
      include: ENROLLMENT_INCLUDE,
      orderBy: { enrolledAt: 'desc' },
    });
  }

  /** Same filters as `list`, mapped to CSV — matching the old Enrollment export. */
  async exportCsv(branchId: string, query: QueryEnrollmentDto): Promise<string> {
    const records = await this.prisma.studentEnrollment.findMany({
      where: {
        student: { branchId },
        ...(query.studentId && { studentId: query.studentId }),
        ...(query.academicClassSectionYearId && {
          academicClassSectionYearId: query.academicClassSectionYearId,
        }),
        ...(query.status && { status: query.status }),
      },
      include: ENROLLMENT_INCLUDE,
      orderBy: { enrolledAt: 'desc' },
    });

    const rows = records.map((record) => ({
      studentName: `${record.student.firstName} ${record.student.lastName}`,
      studentCode: record.student.studentCode,
      class: record.academicClassSectionYear.academicClassSection.academicClass.name,
      section: record.academicClassSectionYear.academicClassSection.academicSection.name,
      academicYear: record.academicClassSectionYear.academicYear.name,
      status: record.status,
      enrolledAt: record.enrolledAt.toISOString(),
      withdrawnAt: record.withdrawnAt ? record.withdrawnAt.toISOString() : '',
    }));

    return toCsv(rows, [
      { key: 'studentName', header: 'Student Name' },
      { key: 'studentCode', header: 'Student Code' },
      { key: 'class', header: 'Class' },
      { key: 'section', header: 'Section' },
      { key: 'academicYear', header: 'Academic Year' },
      { key: 'status', header: 'Status' },
      { key: 'enrolledAt', header: 'Enrolled At' },
      { key: 'withdrawnAt', header: 'Withdrawn At' },
    ]);
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.studentEnrollment.findFirst({
      where: { id, student: { branchId } },
      include: ENROLLMENT_INCLUDE,
    });
    if (!record) {
      throw new NotFoundException('Enrollment not found');
    }
    return record;
  }

  private async assertStudentBelongsToBranch(branchId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, branchId } });
    if (!student) {
      throw new BadRequestException('studentId must belong to this branch');
    }
    return student;
  }

  private async assertClassSectionYearBelongsToBranch(branchId: string, academicClassSectionYearId: string) {
    const classSectionYear = await this.prisma.academicClassSectionYear.findFirst({
      where: { id: academicClassSectionYearId, academicClassSection: { academicClass: { branchId } } },
    });
    if (!classSectionYear) {
      throw new BadRequestException('academicClassSectionYearId must belong to this branch');
    }
    return classSectionYear;
  }

  private async assertCapacityAvailable(academicClassSectionYearId: string, capacity: number | null) {
    if (capacity === null || capacity === undefined) {
      return;
    }
    const activeCount = await this.prisma.studentEnrollment.count({
      where: { academicClassSectionYearId, status: 'ACTIVE' },
    });
    if (activeCount >= capacity) {
      throw new ConflictException('This class section year has reached its enrollment capacity');
    }
  }

  async create(branchId: string, dto: CreateEnrollmentDto) {
    await this.assertStudentBelongsToBranch(branchId, dto.studentId);
    const classSectionYear = await this.assertClassSectionYearBelongsToBranch(
      branchId,
      dto.academicClassSectionYearId,
    );

    const existing = await this.prisma.studentEnrollment.findUnique({
      where: {
        studentId_academicClassSectionYearId: {
          studentId: dto.studentId,
          academicClassSectionYearId: dto.academicClassSectionYearId,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'An enrollment already exists for this student in this class section year',
      );
    }

    await this.assertCapacityAvailable(dto.academicClassSectionYearId, classSectionYear.capacity);

    return this.prisma.studentEnrollment.create({
      data: {
        studentId: dto.studentId,
        academicClassSectionYearId: dto.academicClassSectionYearId,
        status: 'ACTIVE',
      },
      include: ENROLLMENT_INCLUDE,
    });
  }

  async transfer(branchId: string, id: string, dto: TransferEnrollmentDto) {
    const current = await this.findOne(branchId, id);
    if (current.status !== 'ACTIVE') {
      throw new ConflictException('Only an ACTIVE enrollment can be transferred');
    }

    const targetClassSectionYear = await this.assertClassSectionYearBelongsToBranch(
      branchId,
      dto.toAcademicClassSectionYearId,
    );

    const existingTarget = await this.prisma.studentEnrollment.findUnique({
      where: {
        studentId_academicClassSectionYearId: {
          studentId: current.studentId,
          academicClassSectionYearId: dto.toAcademicClassSectionYearId,
        },
      },
    });
    if (existingTarget) {
      throw new ConflictException(
        'An enrollment already exists for this student in the target class section year',
      );
    }

    await this.assertCapacityAvailable(dto.toAcademicClassSectionYearId, targetClassSectionYear.capacity);

    const newEnrollment = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.studentEnrollment.update({
        where: { id: current.id },
        data: { status: 'TRANSFERRED', withdrawnAt: now },
      });

      return tx.studentEnrollment.create({
        data: {
          studentId: current.studentId,
          academicClassSectionYearId: dto.toAcademicClassSectionYearId,
          status: 'ACTIVE',
          transferredFromId: current.id,
        },
        include: { ...ENROLLMENT_INCLUDE, transferredFrom: true },
      });
    });

    return newEnrollment;
  }

  async withdraw(branchId: string, id: string) {
    const current = await this.findOne(branchId, id);
    if (current.status !== 'ACTIVE') {
      throw new ConflictException(`Cannot withdraw an enrollment with status ${current.status}`);
    }
    return this.prisma.studentEnrollment.update({
      where: { id },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
      include: ENROLLMENT_INCLUDE,
    });
  }
}
