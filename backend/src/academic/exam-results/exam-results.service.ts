import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExamResultStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkEntryResultsDto } from './dto/bulk-entry-results.dto';
import { PublishResultsDto } from './dto/publish-results.dto';

@Injectable()
export class ExamResultsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findExam(branchId: string, examId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, branchId } });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return exam;
  }

  private studentSelect() {
    return { select: { name: true, studentCode: true } };
  }

  async list(branchId: string, examId: string) {
    await this.findExam(branchId, examId);
    return this.prisma.studentExamResult.findMany({
      where: { examId },
      include: { student: this.studentSelect() },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async assertStudentsBelongToBranch(branchId: string, studentIds: string[]) {
    const uniqueIds = [...new Set(studentIds)];
    const students = await this.prisma.student.findMany({
      where: { id: { in: uniqueIds }, branchId },
      select: { id: true },
    });
    const foundIds = new Set(students.map((s) => s.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new BadRequestException(`studentId(s) not found in this branch: ${missing.join(', ')}`);
    }
  }

  /**
   * Rejects the whole batch (no partial writes) if any entry exceeds the
   * exam's maxMarks, or if any entry targets a result already PUBLISHED —
   * publishing locks a result against further edits via this endpoint.
   */
  async bulkEntry(branchId: string, examId: string, actorUserId: string, dto: BulkEntryResultsDto) {
    const exam = await this.findExam(branchId, examId);
    const maxMarks = Number(exam.maxMarks);

    const overLimit = dto.results.filter((r) => r.marksObtained > maxMarks).map((r) => r.studentId);
    if (overLimit.length) {
      throw new BadRequestException(
        `marksObtained exceeds maxMarks (${maxMarks}) for student(s): ${overLimit.join(', ')}`,
      );
    }

    const studentIds = dto.results.map((r) => r.studentId);
    await this.assertStudentsBelongToBranch(branchId, studentIds);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.studentExamResult.findMany({
        where: { examId, studentId: { in: studentIds } },
      });
      const publishedLocked = existing
        .filter((e) => e.status === ExamResultStatus.PUBLISHED)
        .map((e) => e.studentId);
      if (publishedLocked.length) {
        throw new BadRequestException(
          `Cannot modify already-published result(s) for student(s): ${publishedLocked.join(', ')}`,
        );
      }

      const upserted: Array<Awaited<ReturnType<typeof tx.studentExamResult.upsert>>> = [];
      for (const item of dto.results) {
        const result = await tx.studentExamResult.upsert({
          where: { examId_studentId: { examId, studentId: item.studentId } },
          create: {
            examId,
            studentId: item.studentId,
            marksObtained: item.marksObtained,
            remark: item.remark,
            status: ExamResultStatus.DRAFT,
            enteredById: actorUserId,
          },
          update: {
            marksObtained: item.marksObtained,
            remark: item.remark,
            enteredById: actorUserId,
          },
        });
        upserted.push(result);
      }
      return upserted;
    });
  }

  /**
   * Publishes DRAFT results for this exam. If studentIds is omitted, every
   * currently-DRAFT result for the exam is published; otherwise only the
   * DRAFT results for the given students are published (already-PUBLISHED
   * rows and rows for students not in the list are left untouched).
   */
  async publish(branchId: string, examId: string, dto: PublishResultsDto) {
    await this.findExam(branchId, examId);
    const result = await this.prisma.studentExamResult.updateMany({
      where: {
        examId,
        status: ExamResultStatus.DRAFT,
        ...(dto.studentIds?.length && { studentId: { in: dto.studentIds } }),
      },
      data: { status: ExamResultStatus.PUBLISHED },
    });
    return { published: result.count };
  }

  /**
   * KNOWN SIMPLIFICATION: the schema has no direct relation from Exam (or
   * ExamType) to an academic class/section, so there is no way to scope
   * "enrolled students for this exam" more precisely. This returns all
   * ACTIVE students in the branch who have no StudentExamResult row at all
   * for this exam yet — i.e. branch-wide unmarked students, not class-scoped.
   */
  async unmarkedStudents(branchId: string, examId: string) {
    await this.findExam(branchId, examId);
    const marked = await this.prisma.studentExamResult.findMany({
      where: { examId },
      select: { studentId: true },
    });
    const markedIds = marked.map((m) => m.studentId);
    return this.prisma.student.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
        ...(markedIds.length && { id: { notIn: markedIds } }),
      },
      select: { id: true, name: true, studentCode: true },
      orderBy: { name: 'asc' },
    });
  }
}
