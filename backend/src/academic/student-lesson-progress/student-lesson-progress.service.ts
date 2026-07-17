import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LessonProgressStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentLessonProgressDto } from './dto/create-student-lesson-progress.dto';
import { MarkStudentLessonProgressDto } from './dto/mark-student-lesson-progress.dto';

@Injectable()
export class StudentLessonProgressService {
  constructor(private readonly prisma: PrismaService) {}

  private includeClause() {
    return {
      student: { select: { firstName: true, lastName: true, studentCode: true } },
      lesson: { select: { title: true } },
    };
  }

  list(branchId: string, studentId?: string, lessonId?: string, status?: LessonProgressStatus) {
    return this.prisma.studentLessonProgress.findMany({
      where: {
        student: { branchId },
        lesson: { branchId },
        ...(studentId && { studentId }),
        ...(lessonId && { lessonId }),
        ...(status && { status }),
      },
      include: this.includeClause(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.studentLessonProgress.findFirst({
      where: { id, student: { branchId }, lesson: { branchId } },
      include: this.includeClause(),
    });
    if (!record) {
      throw new NotFoundException('Student lesson progress record not found');
    }
    return record;
  }

  private async assertStudentAndLessonBelongToBranch(
    branchId: string,
    studentId: string,
    lessonId: string,
  ) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, branchId } });
    if (!student) {
      throw new BadRequestException('studentId must belong to this branch');
    }
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, branchId } });
    if (!lesson) {
      throw new BadRequestException('lessonId must belong to this branch');
    }
  }

  /**
   * `[studentId, lessonId]` has no nullable column involved, so a real Prisma
   * `upsert` on that compound unique key is safe here (same reasoning as
   * AttendanceService.clockIn's `employeeId_date` upsert).
   */
  async create(branchId: string, dto: CreateStudentLessonProgressDto) {
    await this.assertStudentAndLessonBelongToBranch(branchId, dto.studentId, dto.lessonId);
    return this.prisma.studentLessonProgress.upsert({
      where: { studentId_lessonId: { studentId: dto.studentId, lessonId: dto.lessonId } },
      create: {
        studentId: dto.studentId,
        lessonId: dto.lessonId,
        status: LessonProgressStatus.NOT_STARTED,
      },
      update: {},
      include: this.includeClause(),
    });
  }

  async mark(branchId: string, id: string, dto: MarkStudentLessonProgressDto) {
    const record = await this.findOne(branchId, id);
    if (record.status === LessonProgressStatus.VERIFIED) {
      throw new ConflictException('A verified record is locked and cannot be marked');
    }
    return this.prisma.studentLessonProgress.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === LessonProgressStatus.COMPLETED && { completedAt: new Date() }),
      },
      include: this.includeClause(),
    });
  }

  /**
   * Resolves the caller's OWN Teacher record from their userId — same
   * self-service resolution pattern as AttendanceService.resolveOwnEmployeeId.
   * Verification must be tied to an actual Teacher profile, never a
   * client-supplied id.
   */
  private async resolveOwnTeacherId(userId: string): Promise<string> {
    const teacher = await this.prisma.teacher.findFirst({ where: { userId } });
    if (!teacher) {
      throw new BadRequestException('Only a teacher account can verify progress');
    }
    return teacher.id;
  }

  async verify(branchId: string, id: string, userId: string) {
    const record = await this.findOne(branchId, id);
    if (record.status !== LessonProgressStatus.COMPLETED) {
      throw new ConflictException('Only completed progress can be verified');
    }
    const teacherId = await this.resolveOwnTeacherId(userId);
    return this.prisma.studentLessonProgress.update({
      where: { id },
      data: {
        status: LessonProgressStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: teacherId,
      },
      include: this.includeClause(),
    });
  }

  async reset(branchId: string, id: string) {
    await this.findOne(branchId, id);
    return this.prisma.studentLessonProgress.update({
      where: { id },
      data: {
        status: LessonProgressStatus.NOT_STARTED,
        completedAt: null,
        verifiedAt: null,
        verifiedById: null,
      },
      include: this.includeClause(),
    });
  }
}
