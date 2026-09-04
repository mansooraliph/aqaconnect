import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Gender, StudentExamOutcome } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HifdhService } from '../../academic/hifdh/hifdh.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ClassSectionYearsQueryDto } from './dto/class-section-years-query.dto';
import { AdmissionYearReportQueryDto } from './dto/admission-year-report-query.dto';
import { AcademicClassesQueryDto } from './dto/academic-classes-query.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { AddStudentExamDto } from './dto/add-student-exam.dto';
import { UpdateStudentExamDto } from './dto/update-student-exam.dto';

const SALT_ROUNDS = 10;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return `${pad2(date.getUTCDate())}-${pad2(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
}
function formatDateTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  return `${formatDate(date)} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function fullName(user: { firstName: string; lastName: string | null } | null | undefined): string {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}
function randomPassword(): string {
  return randomBytes(8).toString('base64url');
}
function splitName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.length > 0 ? rest.join(' ') : undefined };
}
function toGenderEnum(gender?: 'male' | 'female'): Gender | undefined {
  return gender ? (gender === 'male' ? Gender.MALE : Gender.FEMALE) : undefined;
}
function toLegacyGender(gender: Gender | null): string | null {
  return gender ? gender.toLowerCase() : null;
}

@Injectable()
export class MobileStudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hifdh: HifdhService,
  ) {}

  private async nextStudentCode(branchId: string): Promise<string> {
    const count = await this.prisma.student.count({ where: { branchId } });
    return String(count + 1);
  }

  private async assertUsernameAvailable(username: string, excludeUserId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== excludeUserId) {
      throw new UnprocessableEntityException({ status: 'error', message: 'The username has already been taken.' });
    }
  }

  private async assertStudentCodeAvailable(branchId: string, code: string, excludeId?: string) {
    const existing = await this.prisma.student.findFirst({
      where: { branchId, studentCode: code, ...(excludeId && { id: { not: excludeId } }) },
    });
    if (existing) {
      throw new BadRequestException({ status: 'error', message: 'Student ID already exists in your organization' });
    }
  }

  /** Validates halqa_id and returns the resolved teacherId, mirroring legacy's automatic teacher lookup off the Halqa. */
  private async resolveHalqaTeacher(branchId: string, halqaId?: string): Promise<void> {
    if (!halqaId) return;
    const halqa = await this.prisma.halqa.findFirst({ where: { id: halqaId, branchId } });
    if (!halqa || halqa.status !== 'ACTIVE') {
      throw new BadRequestException({
        status: 'error',
        message: 'Selected halqa is not active or does not exist',
      });
    }
    if (!halqa.teacherId) {
      throw new BadRequestException({ status: 'error', message: 'No teacher assigned to the selected halqa' });
    }
  }

  private async halqaAndTeacherInfo(halqaId: string | null) {
    if (!halqaId) return { halqa: null, teacher: null };
    const halqa = await this.prisma.halqa.findUnique({
      where: { id: halqaId },
      include: { teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
    });
    if (!halqa) return { halqa: null, teacher: null };
    return {
      halqa: { id: halqa.id, name: halqa.name, status: halqa.status.toLowerCase() },
      teacher: halqa.teacher
        ? { id: halqa.teacherId, name: fullName(halqa.teacher.user), email: halqa.teacher.user?.email ?? null }
        : null,
    };
  }

  private async serializeStudent(studentId: string) {
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: { user: true },
    });
    const { halqa, teacher } = await this.halqaAndTeacherInfo(
      (await this.prisma.halqaStudent.findFirst({ where: { studentId, removedAt: null } }))?.halqaId ?? null,
    );
    const halqaId = (await this.prisma.halqaStudent.findFirst({ where: { studentId, removedAt: null } }))?.halqaId ?? null;

    return {
      id: student.id,
      name: student.name,
      email: student.user?.email ?? null,
      mobile: student.user?.phone ?? null,
      country_phonecode: null, // no Country concept in this schema
      gender: toLegacyGender(student.gender),
      status: student.status.toLowerCase(),
      student_details: {
        id: student.id,
        student_id: student.studentCode,
        father_name: student.guardianName, // see mapping note in create()/update()
        mother_name: null, // no separate mother_name column in this schema
        guardian_name: student.guardianName,
        mobile_1: student.user?.phone ?? null,
        mobile_2: null,
        whatsapp: null,
        joining_date: student.joiningDate ? toDateOnly(student.joiningDate) : null,
        blood_group: null,
        address: null,
        halqa_id: halqaId,
        hifdh_start_date: student.hifdhStartDate ? toDateOnly(student.hifdhStartDate) : null,
      },
      halqa,
      teacher,
      username: student.user?.username ?? null,
      created_at: formatDateTime(student.createdAt),
    };
  }

  async createStudent(branchId: string, userId: string, dto: CreateStudentDto) {
    await this.assertUsernameAvailable(dto.username);
    await this.resolveHalqaTeacher(branchId, dto.halqa_id);

    if (dto.student_id) {
      await this.assertStudentCodeAvailable(branchId, dto.student_id);
    }

    const { firstName, lastName } = splitName(dto.name);
    const password = dto.password ?? randomPassword();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const studentCode = dto.student_id ?? (await this.nextStudentCode(branchId));
    const guardianName = dto.guardian_name ?? dto.father_name;

    const studentId = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: dto.username,
          passwordHash,
          firstName,
          lastName,
          phone: dto.mobile_1,
          branchId,
          isActive: dto.login !== 'disable',
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          branchId,
          studentCode,
          name: dto.name,
          guardianName,
          gender: toGenderEnum(dto.gender),
          joiningDate: dto.joining_date ? new Date(dto.joining_date) : new Date(),
          hifdhStartDate: dto.hifdh_start_date ? new Date(dto.hifdh_start_date) : undefined,
        },
      });

      // Auto-assign the seeded "Student" role so the account is immediately
      // usable on the mobile app, mirroring TeachersService's convention.
      const studentRole = await tx.role.findUnique({ where: { name: 'Student' } });
      if (studentRole) {
        await tx.userRole.create({ data: { userId: user.id, roleId: studentRole.id } });
      }

      if (dto.halqa_id) {
        await tx.halqaStudent.create({ data: { halqaId: dto.halqa_id, studentId: student.id } });
      }

      return student.id;
    });

    await this.hifdh.generateInitialSchedulesForStudent(studentId, branchId, dto.halqa_id ?? '', dto.hifdh_start_date);

    const data = await this.serializeStudent(studentId);
    return { ...data, generated_password: dto.password ? null : password };
  }

  async updateStudent(branchId: string, userId: string, id: string, dto: UpdateStudentDto) {
    const existing = await this.prisma.student.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException({ status: 'error', message: 'Student not found' });
    }

    if (dto.username !== undefined) {
      await this.assertUsernameAvailable(dto.username, existing.userId ?? undefined);
    }
    if (dto.student_id !== undefined) {
      await this.assertStudentCodeAvailable(branchId, dto.student_id, id);
    }
    if (dto.halqa_id !== undefined) {
      await this.resolveHalqaTeacher(branchId, dto.halqa_id);
    }

    const nameParts = dto.name !== undefined ? splitName(dto.name) : undefined;

    await this.prisma.$transaction(async (tx) => {
      if (existing.userId) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            ...(nameParts && { firstName: nameParts.firstName, lastName: nameParts.lastName ?? null }),
            ...(dto.mobile_1 !== undefined && { phone: dto.mobile_1 }),
            ...(dto.username !== undefined && { username: dto.username }),
            ...(dto.login !== undefined && { isActive: dto.login !== 'disable' }),
          },
        });
      }

      await tx.student.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.gender !== undefined && { gender: toGenderEnum(dto.gender) }),
          ...(dto.student_id !== undefined && { studentCode: dto.student_id }),
          ...(dto.guardian_name !== undefined && { guardianName: dto.guardian_name }),
          ...(dto.father_name !== undefined && dto.guardian_name === undefined && { guardianName: dto.father_name }),
          ...(dto.joining_date !== undefined && {
            joiningDate: dto.joining_date ? new Date(dto.joining_date) : null,
          }),
          ...(dto.hifdh_start_date !== undefined && {
            hifdhStartDate: dto.hifdh_start_date ? new Date(dto.hifdh_start_date) : null,
          }),
        },
      });

      if (dto.halqa_id !== undefined) {
        await tx.halqaStudent.updateMany({ where: { studentId: id, removedAt: null }, data: { removedAt: new Date() } });
        if (dto.halqa_id) {
          const existingMembership = await tx.halqaStudent.findUnique({
            where: { halqaId_studentId: { halqaId: dto.halqa_id, studentId: id } },
          });
          if (existingMembership) {
            await tx.halqaStudent.update({ where: { id: existingMembership.id }, data: { removedAt: null } });
          } else {
            await tx.halqaStudent.create({ data: { halqaId: dto.halqa_id, studentId: id } });
          }
        }
      }
    });

    const data = await this.serializeStudent(id);
    return { ...data, generated_password: null };
  }

  async getStudentDetails(branchId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, branchId },
      include: { user: true },
    });
    if (!student) {
      throw new NotFoundException({ status: 'error', message: 'Student not found' });
    }

    const membership = await this.prisma.halqaStudent.findFirst({ where: { studentId, removedAt: null } });
    const { halqa: halqaBase, teacher } = await this.halqaAndTeacherInfo(membership?.halqaId ?? null);
    let halqaInfo: Record<string, unknown> | null = null;
    if (membership) {
      const halqa = await this.prisma.halqa.findUnique({
        where: { id: membership.halqaId },
        include: { currentClass: { select: { id: true, name: true } } },
      });
      halqaInfo = {
        ...halqaBase,
        start_date: halqa?.startDate ? formatDate(halqa.startDate) : null,
        teacher,
        current_class: halqa?.currentClass ? { id: halqa.currentClass.id, name: halqa.currentClass.name } : null,
      };
    }

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: {
        academicClassSectionYear: {
          include: {
            academicYear: true,
            academicClassSection: { include: { academicClass: true, academicSection: true } },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });
    const enrollmentInfo = enrollment
      ? {
          id: enrollment.id,
          roll_no: null, // no roll-number column in this schema
          enrolled_on: formatDate(enrollment.enrolledAt),
          status: enrollment.status.toLowerCase(),
          academic_year: {
            id: enrollment.academicClassSectionYear.academicYear.id,
            name: enrollment.academicClassSectionYear.academicYear.name,
            start_date: enrollment.academicClassSectionYear.academicYear.startDate,
            end_date: enrollment.academicClassSectionYear.academicYear.endDate,
            is_current: enrollment.academicClassSectionYear.academicYear.isCurrent,
          },
          academic_class: {
            id: enrollment.academicClassSectionYear.academicClassSection.academicClass.id,
            name: enrollment.academicClassSectionYear.academicClassSection.academicClass.name,
          },
          academic_section: {
            id: enrollment.academicClassSectionYear.academicClassSection.academicSection.id,
            name: enrollment.academicClassSectionYear.academicClassSection.academicSection.name,
          },
        }
      : null;

    return {
      status: 'success',
      data: {
        student: {
          id: student.id,
          name: student.name,
          email: student.user?.email ?? null,
          mobile: student.user?.phone ?? null,
          country_phonecode: null,
          gender: toLegacyGender(student.gender),
          status: student.status.toLowerCase(),
          login: student.user?.isActive === false ? 'disable' : 'enable',
          email_notifications: true, // no notification-preferences subsystem in this schema
          locale: null,
          salutation: null,
          image_url: null,
          created_at: formatDateTime(student.createdAt),
          updated_at: formatDateTime(student.updatedAt),
        },
        student_details: {
          id: student.id,
          student_id: student.studentCode,
          father_name: student.guardianName,
          mother_name: null,
          guardian_name: student.guardianName,
          mobile_1: student.user?.phone ?? null,
          mobile_2: null,
          whatsapp: null,
          mobile_1_country_code: null,
          mobile_2_country_code: null,
          whatsapp_country_code: null,
          joining_date: student.joiningDate ? toDateOnly(student.joiningDate) : null,
          blood_group: null,
          address: null,
          halqa_id: membership?.halqaId ?? null,
        },
        halqa: halqaInfo,
        enrollment: enrollmentInfo,
        custom_fields: null, // no custom-fields subsystem in this schema
      },
    };
  }

  async getAcademicClassSectionYears(branchId: string, query: ClassSectionYearsQueryDto) {
    const items = await this.prisma.academicClassSectionYear.findMany({
      where: {
        academicClassSection: {
          ...(query.class_id && { academicClassId: query.class_id }),
          ...(query.section_id && { academicSectionId: query.section_id }),
          academicClass: { branchId },
        },
        ...(query.academic_year_id && { academicYearId: query.academic_year_id }),
        ...(query.status && { status: query.status === 'active' ? 'ACTIVE' : 'INACTIVE' }),
      },
      include: {
        academicYear: true,
        academicClassSection: { include: { academicClass: true, academicSection: true } },
      },
      orderBy: [{ academicYear: { isCurrent: 'desc' } }],
    });

    const formatted = items.map((item) => ({
      id: item.id,
      academic_year: {
        id: item.academicYear.id,
        name: item.academicYear.name,
        start_date: item.academicYear.startDate,
        end_date: item.academicYear.endDate,
        is_current: item.academicYear.isCurrent,
      },
      academic_class: {
        id: item.academicClassSection.academicClass.id,
        name: item.academicClassSection.academicClass.name,
        status: item.academicClassSection.academicClass.status.toLowerCase(),
      },
      academic_section: {
        id: item.academicClassSection.academicSection.id,
        name: item.academicClassSection.academicSection.name,
        status: item.academicClassSection.academicSection.status.toLowerCase(),
      },
      class_teacher: null, // no per-class-section-year teacher assignment in this schema
      display_name: `${item.academicClassSection.academicClass.name} - ${item.academicClassSection.academicSection.name}`,
      full_display_name: `${item.academicYear.name} | ${item.academicClassSection.academicClass.name} - ${item.academicClassSection.academicSection.name}`,
      max_students: item.capacity,
      teacher_name: null,
      notes: null,
      status: item.status.toLowerCase(),
      added_by: null,
      last_updated_by: null,
      created_at: formatDateTime(item.createdAt),
      updated_at: formatDateTime(item.updatedAt),
    }));

    const activeCount = items.filter((i) => i.status === 'ACTIVE').length;
    const inactiveCount = items.filter((i) => i.status === 'INACTIVE').length;

    const byYear = new Map<string, { year_id: string; year_name: string; is_current: boolean; count: number }>();
    for (const item of items) {
      const key = item.academicYear.id;
      const entry = byYear.get(key) ?? {
        year_id: key,
        year_name: item.academicYear.name,
        is_current: item.academicYear.isCurrent,
        count: 0,
      };
      entry.count += 1;
      byYear.set(key, entry);
    }

    return {
      status: 'success',
      message: 'Academic class section years retrieved successfully',
      data: {
        class_section_years: formatted,
        total_count: items.length,
        summary: { active: activeCount, inactive: inactiveCount, by_year: [...byYear.values()] },
        filters_applied: {
          academic_year_id: query.academic_year_id ?? null,
          class_id: query.class_id ?? null,
          section_id: query.section_id ?? null,
          teacher_id: query.teacher_id ?? null,
          status: query.status ?? null,
          search: query.search ?? null,
        },
        company_id: branchId,
      },
    };
  }

  async admissionYearReport(branchId: string, query: AdmissionYearReportQueryDto) {
    const students = await this.prisma.student.findMany({
      where: {
        branchId,
        ...(query.year && {
          joiningDate: {
            gte: new Date(Date.UTC(Number(query.year), 0, 1)),
            lt: new Date(Date.UTC(Number(query.year) + 1, 0, 1)),
          },
        }),
        ...((query.class_id || query.academic_year_id) && {
          enrollments: {
            some: {
              academicClassSectionYear: {
                ...(query.class_id && { academicClassSection: { academicClassId: query.class_id } }),
                ...(query.academic_year_id && { academicYearId: query.academic_year_id }),
              },
            },
          },
        }),
      },
      include: {
        enrollments: {
          include: { academicClassSectionYear: { include: { academicYear: true, academicClassSection: { include: { academicClass: true } } } } },
          orderBy: { enrolledAt: 'desc' },
        },
      },
    });

    const formatStudent = (student: (typeof students)[number]) => {
      const enrollment = student.enrollments.find(
        (e) => !query.academic_year_id || e.academicClassSectionYear.academicYearId === query.academic_year_id,
      );
      const classInfo = enrollment
        ? {
            id: enrollment.academicClassSectionYear.academicClassSection.academicClass.id,
            name: enrollment.academicClassSectionYear.academicClassSection.academicClass.name,
            academic_year: {
              id: enrollment.academicClassSectionYear.academicYear.id,
              name: enrollment.academicClassSectionYear.academicYear.name,
            },
          }
        : null;

      return {
        id: student.id,
        name: student.name,
        student_id: student.studentCode,
        joining_date: student.joiningDate ? toDateOnly(student.joiningDate) : null,
        class: classInfo,
      };
    };

    if (query.year) {
      const data: Record<string, unknown> = {
        year: query.year,
        total_students: students.length,
        students: students.map(formatStudent),
      };
      if (query.class_id) data.filtered_by_class_id = query.class_id;
      if (query.academic_year_id) data.academic_year_id = query.academic_year_id;
      return { status: 'success', data };
    }

    const byYear = new Map<string, (typeof students)[number][]>();
    for (const student of students) {
      if (!student.joiningDate) continue;
      const year = String(student.joiningDate.getUTCFullYear());
      const list = byYear.get(year) ?? [];
      list.push(student);
      byYear.set(year, list);
    }

    const data = [...byYear.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, group]) => ({ year, total_students: group.length, students: group.map(formatStudent) }));

    return {
      status: 'success',
      data,
      filters: { class_id: query.class_id ?? null, academic_year_id: query.academic_year_id ?? null },
    };
  }

  async destroyStudent(branchId: string, id: string) {
    const student = await this.prisma.student.findFirst({ where: { id, branchId } });
    if (!student) {
      throw new NotFoundException({ status: 'error', message: 'Student details not found' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.studentEnrollment.deleteMany({ where: { studentId: id } });
      await tx.student.delete({ where: { id } });
      if (student.userId) {
        await tx.user.delete({ where: { id: student.userId } });
      }
    });
  }

  async getAcademicClasses(branchId: string, query: AcademicClassesQueryDto) {
    let classIds: string[] | undefined;
    if (query.academic_year_id) {
      const rows = await this.prisma.academicClassSectionYear.findMany({
        where: { academicYearId: query.academic_year_id },
        select: { academicClassSection: { select: { academicClassId: true } } },
      });
      classIds = [...new Set(rows.map((r) => r.academicClassSection.academicClassId))];
    }

    const classes = await this.prisma.academicClass.findMany({
      where: { branchId, status: 'ACTIVE', ...(classIds && { id: { in: classIds } }) },
      select: { id: true, name: true, code: true, status: true },
      orderBy: { name: 'asc' },
    });

    return {
      status: 'success',
      filters: { academic_year_id: query.academic_year_id ?? null },
      total_classes: classes.length,
      data: classes.map((c) => ({ id: c.id, name: c.name, code: c.code, status: c.status.toLowerCase() })),
    };
  }

  async addStudentExam(branchId: string, dto: AddStudentExamDto) {
    const student = await this.prisma.student.findFirst({ where: { id: dto.student_id, branchId } });
    if (!student) {
      throw new NotFoundException({ status: 'error', message: 'Student not found in your organization' });
    }

    const exam = await this.prisma.studentExam.create({
      data: {
        branchId,
        studentId: dto.student_id,
        examDate: new Date(dto.exam_date),
        examId: dto.exam_id,
        result: dto.result ? (dto.result.toUpperCase() as StudentExamOutcome) : undefined,
        marks: dto.marks,
        remarks: dto.remarks,
        scheduleId: dto.schedule_id,
      },
    });

    return serializeExam(exam);
  }

  async updateStudentExam(branchId: string, examId: string, dto: UpdateStudentExamDto) {
    const exam = await this.prisma.studentExam.findFirst({ where: { id: examId, branchId } });
    if (!exam) {
      throw new NotFoundException({ status: 'error', message: 'Exam record not found' });
    }

    if (dto.student_id !== undefined) {
      const student = await this.prisma.student.findFirst({ where: { id: dto.student_id, branchId } });
      if (!student) {
        throw new NotFoundException({
          status: 'error',
          message: 'The specified student does not exist or is not a student',
        });
      }
    }

    const updated = await this.prisma.studentExam.update({
      where: { id: examId },
      data: {
        ...(dto.student_id !== undefined && { studentId: dto.student_id }),
        ...(dto.exam_date !== undefined && { examDate: new Date(dto.exam_date) }),
        ...(dto.exam_id !== undefined && { examId: dto.exam_id }),
        ...(dto.result !== undefined && { result: dto.result.toUpperCase() as StudentExamOutcome }),
        ...(dto.marks !== undefined && { marks: dto.marks }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        ...(dto.schedule_id !== undefined && { scheduleId: dto.schedule_id }),
      },
    });

    return serializeExam(updated);
  }

  private resolveDateRange(query: ActivityQueryDto, joiningDate: Date) {
    let start: Date;
    let end: Date;
    if (query.year) {
      const year = Number(query.year);
      if (query.month) {
        const month = Number(query.month);
        start = new Date(Date.UTC(year, month - 1, 1));
        end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      } else {
        start = new Date(Date.UTC(year, 0, 1));
        end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      }
    } else if (query.start_date || query.end_date) {
      start = query.start_date ? new Date(`${query.start_date}T00:00:00.000Z`) : new Date(joiningDate);
      end = query.end_date ? new Date(`${query.end_date}T23:59:59.999Z`) : new Date();
    } else {
      start = new Date(joiningDate);
      end = new Date();
    }
    return { start, end };
  }

  /** Shared by getStudentActivityReport (no id/record_type, no exams) and getStudentActivity (adds both). */
  private async buildActivityTimeline(
    branchId: string,
    studentId: string,
    query: ActivityQueryDto,
    opts: { includeIdAndType: boolean; includeExams: boolean },
  ) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, branchId } });
    if (!student) {
      throw new NotFoundException({ status: 'error', message: 'Student not found' });
    }

    const joiningDate = student.joiningDate ?? student.createdAt;
    const { start, end } = this.resolveDateRange(query, joiningDate);

    const activitiesByDate = new Map<string, Record<string, unknown>[]>();
    const push = (date: string, entry: Record<string, unknown>) => {
      const list = activitiesByDate.get(date) ?? [];
      list.push(entry);
      activitiesByDate.set(date, list);
    };
    const withId = (entry: Record<string, unknown>, id: string | null, recordType: string) =>
      opts.includeIdAndType ? { ...entry, id, record_type: recordType } : entry;

    // 1. Joining
    const joinDate = new Date(joiningDate);
    if (joinDate >= start && joinDate <= end) {
      push(
        toDateOnly(joinDate),
        withId({ type: 'joining', description: 'Student joined the academy', time: joinDate.toISOString() }, null, 'joining'),
      );
    }

    // 2. Surah Hifdh schedule completions
    const completions = await this.prisma.surahHifdhStudentSchedule.findMany({
      where: { studentId, status: 'COMPLETED', updatedAt: { gte: start, lte: end } },
      include: { surah: { select: { nameEnglish: true } } },
    });
    for (const c of completions) {
      const date = toDateOnly(c.updatedAt);
      const description = c.surah
        ? `Completed portion: ${c.surah.nameEnglish} verses ${c.fromAyah} to ${c.toAyah}`
        : `Completed: ${c.examName ?? 'milestone'}`;
      push(
        date,
        withId({ type: 'surah_schedule_completion', description, time: c.updatedAt.toISOString() }, c.id, 'surah_schedule'),
      );
    }

    // 3. Attendance (no legacy write-path yet in this schema — empty unless populated elsewhere)
    const attendances = await this.prisma.attendance.findMany({
      where: { studentId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
    for (const a of attendances) {
      const date = toDateOnly(a.date);
      let description = 'Attendance recorded';
      if (a.status) description += ` (${a.status.charAt(0) + a.status.slice(1).toLowerCase()})`;
      const time = (a.clockInAt ?? a.date).toISOString();
      const entry: Record<string, unknown> = { type: 'attendance', description, time };
      if (a.clockOutAt) entry.clock_out_time = a.clockOutAt.toISOString();
      push(date, withId(entry, a.id, 'attendance'));
    }

    // 4. Surah-completed events, derived from the per-ayah progress ledger
    // (StudentSurahProgressEntry) — a surah counts as "completed" once every
    // one of its ayah entries is at least COMPLETED (VERIFIED counts too, per
    // the same COMPLETED-or-VERIFIED convention used by getFullProgressReport
    // in student-surah-progress.service.ts); the event date is the latest of
    // those completion/verification timestamps.
    const progressEntries = await this.prisma.studentSurahProgressEntry.findMany({
      where: { studentId, type: 'NEW_LESSON', surahId: { not: null } },
      include: { surah: { select: { nameEnglish: true } } },
    });
    const bySurah = new Map<string, { surahName: string; total: number; verified: number; latestAt: Date }>();
    for (const e of progressEntries) {
      if (!e.surahId || !e.surah) continue;
      const at = e.verifiedAt ?? e.completedAt ?? e.updatedAt;
      const g = bySurah.get(e.surahId) ?? { surahName: e.surah.nameEnglish, total: 0, verified: 0, latestAt: at };
      g.total += 1;
      if (e.status === 'COMPLETED' || e.status === 'VERIFIED') g.verified += 1;
      if (at > g.latestAt) g.latestAt = at;
      bySurah.set(e.surahId, g);
    }
    for (const [surahId, g] of bySurah) {
      if (g.total === 0 || g.verified !== g.total) continue;
      if (g.latestAt < start || g.latestAt > end) continue;
      const date = toDateOnly(g.latestAt);
      push(
        date,
        withId(
          {
            type: 'surah_progress',
            description: `Completed Surah: ${g.surahName}`,
            time: g.latestAt.toISOString(),
            surah_id: surahId,
            total_ayahs: g.total,
          },
          `${studentId}:${surahId}`,
          'surah_progress',
        ),
      );
    }

    // 5. Enrollment changes
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId, createdAt: { gte: start, lte: end } },
    });
    for (const e of enrollments) {
      const date = toDateOnly(e.createdAt);
      push(
        date,
        withId(
          {
            type: 'enrollment',
            description: `Enrolled in class/section (ID: ${e.academicClassSectionYearId})`,
            time: e.createdAt.toISOString(),
          },
          e.id,
          'enrollment',
        ),
      );
    }

    // 6. Leaves
    const leaves = await this.prisma.studentLeave.findMany({
      where: { studentId, status: 'APPROVED', leaveDate: { gte: start, lte: end } },
      orderBy: { leaveDate: 'asc' },
    });
    for (const l of leaves) {
      const date = toDateOnly(l.leaveDate);
      let description = 'Leave approved';
      if (l.reason) description += ` - Reason: ${l.reason}`;
      push(
        date,
        withId({ type: 'leave', description, time: l.createdAt.toISOString(), status: 'approved' }, l.id, 'leave'),
      );
    }

    // 7. Holidays
    const holidays = await this.prisma.calendarDay.findMany({
      where: { branchId, isHoliday: true, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
    for (const h of holidays) {
      const date = toDateOnly(h.date);
      const occasion = h.holidayName ?? 'Holiday';
      push(
        date,
        withId({ type: 'holiday', description: `Holiday: ${occasion}`, date, occasion }, h.id, 'holiday'),
      );
    }

    // 8. Exams (getStudentActivity only)
    if (opts.includeExams) {
      const exams = await this.prisma.studentExam.findMany({
        where: { studentId, examDate: { gte: start, lte: end } },
      });
      for (const ex of exams) {
        const date = toDateOnly(ex.examDate);
        let description = `Exam: ${ex.examId ?? 'General'} - Result: ${ex.result ? EXAM_RESULT_DISPLAY[ex.result] : 'N/A'}`;
        if (ex.marks !== null) description += ` (Marks: ${ex.marks})`;
        push(date, withId({ type: 'exam', description, time: toDateOnly(ex.examDate) }, ex.id, 'exam'));
      }
    }

    const sortedDates = [...activitiesByDate.keys()].sort();
    const activities = sortedDates.map((date) => ({ date, activities: activitiesByDate.get(date) }));

    return {
      status: 'success',
      data: {
        student: {
          id: student.id,
          name: student.name,
          student_id: student.studentCode,
          joining_date: toDateOnly(joiningDate),
        },
        date_range: { start: toDateOnly(start), end: toDateOnly(end) },
        activities,
      },
    };
  }

  // `student_id` is guaranteed non-empty by the controller (resolved to the
  // caller's own student for Student callers, required as an explicit query
  // param otherwise — see StudentsController.resolveActivityReportStudentId).
  async getStudentActivityReport(branchId: string, query: ActivityQueryDto & { student_id: string }) {
    return this.buildActivityTimeline(branchId, query.student_id, query, {
      includeIdAndType: false,
      includeExams: false,
    });
  }

  async getStudentActivity(branchId: string, query: ActivityQueryDto & { student_id: string }) {
    return this.buildActivityTimeline(branchId, query.student_id, query, {
      includeIdAndType: true,
      includeExams: true,
    });
  }
}

const EXAM_RESULT_DISPLAY: Record<StudentExamOutcome, string> = {
  PASS: 'Pass',
  FAIL: 'fail',
  PREPARATION: 'preparation',
};

function serializeExam(exam: {
  id: string;
  studentId: string;
  examDate: Date;
  examId: string | null;
  result: StudentExamOutcome | null;
  marks: unknown;
  remarks: string | null;
  scheduleId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    status: 'success',
    message:
      exam.createdAt.getTime() === exam.updatedAt.getTime()
        ? 'Student exam record added successfully'
        : 'Student exam record updated successfully',
    data: {
      id: exam.id,
      student_id: exam.studentId,
      exam_date: toDateOnly(exam.examDate),
      exam_id: exam.examId,
      result: exam.result ? EXAM_RESULT_DISPLAY[exam.result] : null,
      marks: exam.marks,
      remarks: exam.remarks,
      schedule_id: exam.scheduleId,
    },
  };
}
