import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { mkdirSync, createWriteStream, existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { Gender, StudentExamOutcome, ProgressEntryGrade, ProgressEntryStatus, ProgressEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HifdhService } from '../../academic/hifdh/hifdh.service';
import { MobileContextService } from '../common/mobile-context.service';
import { StudentSurahProgressService } from '../student-surah-progress/student-surah-progress.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ClassSectionYearsQueryDto } from './dto/class-section-years-query.dto';
import { AdmissionYearReportQueryDto } from './dto/admission-year-report-query.dto';
import { AcademicClassesQueryDto } from './dto/academic-classes-query.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { AddStudentExamDto } from './dto/add-student-exam.dto';
import { UpdateStudentExamDto } from './dto/update-student-exam.dto';
import { AddStudentEventDto } from './dto/add-student-event.dto';
import { UpdateStudentEventDto } from './dto/update-student-event.dto';
import { GetExamReportQueryDto } from './dto/get-exam-report-query.dto';
import { REPORTS_DIR } from './report-upload-paths';

const SALT_ROUNDS = 10;

// Bundled fallback used in the report header when a branch hasn't uploaded
// its own logo via Branch Settings.
const DEFAULT_LOGO_PATH = join(process.cwd(), 'assets', 'aqa-logo.jpg');
const BRAND_COLOR = '#1B5E20';
const BRAND_COLOR_LIGHT = '#E8F5E9';

const LESSON_TYPE_LABEL: Record<ProgressEntryType, string> = {
  NEW_LESSON: 'New Lesson',
  OLD_LESSON: 'Old Lesson',
  JUZH_LESSON: 'Juzh Lesson',
};
const STATUS_TO_LEGACY: Record<ProgressEntryStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  VERIFIED: 'Verified',
};
const GRADE_TO_LEGACY: Record<ProgressEntryGrade, string> = {
  VERY_GOOD: 'Very Good',
  GOOD: 'Good',
  AVERAGE: 'Average',
  BAD: 'Bad',
};

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
    private readonly context: MobileContextService,
    private readonly surahProgress: StudentSurahProgressService,
  ) {}

  /**
   * Mirrors StudentSurahProgressService's scoping: a Teacher caller must
   * only ever see their own halqa's students in branch-wide reports.
   * Returns null for non-Teacher callers (no restriction), or the
   * (possibly empty) list of halqa ids the caller actually teaches.
   */
  private async ownHalqaIdsIfTeacher(userId: string): Promise<string[] | null> {
    const isTeacherRole = await this.context.hasRole(userId, 'Teacher');
    if (!isTeacherRole) return null;
    const ownTeacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!ownTeacher) return [];
    const halqas = await this.prisma.halqa.findMany({
      where: { teacherId: ownTeacher.id },
      select: { id: true },
    });
    return halqas.map((h) => h.id);
  }

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
        father_name: student.fatherName,
        mother_name: student.motherName,
        guardian_name: student.guardianName,
        mobile_1: student.user?.phone ?? null,
        mobile_2: student.mobile2,
        whatsapp: student.user?.whatsapp ?? null,
        joining_date: student.joiningDate ? toDateOnly(student.joiningDate) : null,
        blood_group: student.bloodGroup,
        address: student.address,
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
          whatsapp: dto.whatsapp,
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
          fatherName: dto.father_name,
          motherName: dto.mother_name,
          mobile2: dto.mobile_2,
          bloodGroup: dto.blood_group,
          gender: toGenderEnum(dto.gender),
          joiningDate: dto.joining_date ? new Date(dto.joining_date) : new Date(),
          hifdhStartDate: dto.hifdh_start_date ? new Date(dto.hifdh_start_date) : undefined,
          address: dto.address,
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
            ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp }),
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
          ...(dto.father_name !== undefined && { fatherName: dto.father_name }),
          ...(dto.mother_name !== undefined && { motherName: dto.mother_name }),
          ...(dto.mobile_2 !== undefined && { mobile2: dto.mobile_2 }),
          ...(dto.blood_group !== undefined && { bloodGroup: dto.blood_group }),
          ...(dto.joining_date !== undefined && {
            joiningDate: dto.joining_date ? new Date(dto.joining_date) : null,
          }),
          ...(dto.hifdh_start_date !== undefined && {
            hifdhStartDate: dto.hifdh_start_date ? new Date(dto.hifdh_start_date) : null,
          }),
          ...(dto.address !== undefined && { address: dto.address }),
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

      if (dto.class_section_year_id !== undefined || dto.roll_no !== undefined) {
        const currentEnrollment = await tx.studentEnrollment.findFirst({ where: { studentId: id, status: 'ACTIVE' } });

        const changingClass =
          dto.class_section_year_id !== undefined &&
          dto.class_section_year_id !== currentEnrollment?.academicClassSectionYearId;

        if (changingClass) {
          if (currentEnrollment) {
            await tx.studentEnrollment.update({
              where: { id: currentEnrollment.id },
              data: { status: 'TRANSFERRED', withdrawnAt: new Date() },
            });
          }
          if (dto.class_section_year_id) {
            const existingTarget = await tx.studentEnrollment.findUnique({
              where: {
                studentId_academicClassSectionYearId: {
                  studentId: id,
                  academicClassSectionYearId: dto.class_section_year_id,
                },
              },
            });
            if (existingTarget) {
              await tx.studentEnrollment.update({
                where: { id: existingTarget.id },
                data: {
                  status: 'ACTIVE',
                  withdrawnAt: null,
                  ...(dto.roll_no !== undefined && { rollNo: dto.roll_no }),
                },
              });
            } else {
              await tx.studentEnrollment.create({
                data: {
                  studentId: id,
                  academicClassSectionYearId: dto.class_section_year_id,
                  status: 'ACTIVE',
                  transferredFromId: currentEnrollment?.id,
                  ...(dto.roll_no !== undefined && { rollNo: dto.roll_no }),
                },
              });
            }
          }
        } else if (dto.roll_no !== undefined && currentEnrollment) {
          await tx.studentEnrollment.update({ where: { id: currentEnrollment.id }, data: { rollNo: dto.roll_no } });
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
          roll_no: enrollment.rollNo,
          enrolled_on: formatDate(enrollment.enrolledAt),
          status: enrollment.status.toLowerCase(),
          class_section_year_id: enrollment.academicClassSectionYearId,
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
          father_name: student.fatherName,
          mother_name: student.motherName,
          guardian_name: student.guardianName,
          mobile_1: student.user?.phone ?? null,
          mobile_2: student.mobile2,
          whatsapp: student.user?.whatsapp ?? null,
          mobile_1_country_code: null,
          mobile_2_country_code: null,
          whatsapp_country_code: null,
          joining_date: student.joiningDate ? toDateOnly(student.joiningDate) : null,
          blood_group: student.bloodGroup,
          address: student.address,
          hifdh_start_date: student.hifdhStartDate ? toDateOnly(student.hifdhStartDate) : null,
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

  async admissionYearReport(branchId: string, userId: string, query: AdmissionYearReportQueryDto) {
    // Mirrors the scoping already applied to the other branch-wide report
    // endpoints: a Teacher caller only sees their own halqa's students,
    // not every admission in the branch.
    const ownHalqaIds = await this.ownHalqaIdsIfTeacher(userId);

    const students = await this.prisma.student.findMany({
      where: {
        branchId,
        ...(ownHalqaIds !== null && {
          halqaMemberships: {
            some: { halqaId: { in: ownHalqaIds }, removedAt: null },
          },
        }),
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

  // ── getAllStudents ────────────────────────────────────────────────────
  // Branch-wide student listing, independent of halqa — each student
  // carries their current halqa (or null if unassigned) so the caller can
  // show/group across halqas instead of picking one at a time.
  async getAllStudents(branchId: string, search: string) {
    const students = await this.prisma.student.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { studentCode: { contains: search, mode: 'insensitive' } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        user: true,
        halqaMemberships: {
          where: { removedAt: null },
          include: { halqa: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    const studentsData = students.map((student) => {
      const halqa = student.halqaMemberships[0]?.halqa ?? null;
      return {
        id: student.id,
        name: student.name,
        email: student.user?.email ?? null,
        mobile: student.user?.phone ?? null,
        country_phonecode: null,
        gender: toLegacyGender(student.gender),
        status: student.status.toLowerCase(),
        image_url: null,
        created_at: formatDateTime(student.createdAt),
        halqa: halqa ? { id: halqa.id, name: halqa.name } : null,
      };
    });

    return {
      status: 'success',
      data: {
        students: studentsData,
        meta: { search, total_students: studentsData.length },
      },
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

  async deleteStudentExam(branchId: string, examId: string) {
    const exam = await this.prisma.studentExam.findFirst({ where: { id: examId, branchId } });
    if (!exam) {
      throw new NotFoundException({ status: 'error', message: 'Exam record not found' });
    }
    await this.prisma.studentExam.delete({ where: { id: examId } });
  }

  async addStudentEvent(branchId: string, dto: AddStudentEventDto) {
    const student = await this.prisma.student.findFirst({ where: { id: dto.student_id, branchId } });
    if (!student) {
      throw new NotFoundException({ status: 'error', message: 'Student not found in your organization' });
    }

    const eventDate = new Date(dto.event_date);
    const eventDateTo = dto.event_date_to ? new Date(dto.event_date_to) : null;
    if (eventDateTo && eventDateTo < eventDate) {
      throw new UnprocessableEntityException({ status: 'error', message: 'Event To date cannot be before the From date.' });
    }

    const event = await this.prisma.studentEvent.create({
      data: {
        branchId,
        studentId: dto.student_id,
        eventDate,
        eventDateTo,
        eventName: dto.event_name,
        remarks: dto.remarks,
      },
    });

    return serializeEvent(event);
  }

  async updateStudentEvent(branchId: string, eventId: string, dto: UpdateStudentEventDto) {
    const event = await this.prisma.studentEvent.findFirst({ where: { id: eventId, branchId } });
    if (!event) {
      throw new NotFoundException({ status: 'error', message: 'Event record not found' });
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

    const nextEventDate = dto.event_date !== undefined ? new Date(dto.event_date) : event.eventDate;
    const nextEventDateTo =
      dto.event_date_to !== undefined ? (dto.event_date_to ? new Date(dto.event_date_to) : null) : event.eventDateTo;
    if (nextEventDateTo && nextEventDateTo < nextEventDate) {
      throw new UnprocessableEntityException({ status: 'error', message: 'Event To date cannot be before the From date.' });
    }

    const updated = await this.prisma.studentEvent.update({
      where: { id: eventId },
      data: {
        ...(dto.student_id !== undefined && { studentId: dto.student_id }),
        ...(dto.event_date !== undefined && { eventDate: nextEventDate }),
        ...(dto.event_date_to !== undefined && { eventDateTo: nextEventDateTo }),
        ...(dto.event_name !== undefined && { eventName: dto.event_name }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
      },
    });

    return serializeEvent(updated);
  }

  async deleteStudentEvent(branchId: string, eventId: string) {
    const event = await this.prisma.studentEvent.findFirst({ where: { id: eventId, branchId } });
    if (!event) {
      throw new NotFoundException({ status: 'error', message: 'Event record not found' });
    }
    await this.prisma.studentEvent.delete({ where: { id: eventId } });
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

    // 2. Surah Hifdh schedule completions — deliberately not surfaced in the
    // activity timeline for now (per product decision): the underlying
    // schedule-sync (SurahHifdhStudentSchedule status flips) still runs
    // fine on its own in student-surah-progress.service.ts, this just stops
    // duplicating it as a separate "Schedule updated" timeline entry, since
    // the real lesson marking already shows as its own activity.
    // const completions = await this.prisma.surahHifdhStudentSchedule.findMany({
    //   where: { studentId, status: 'COMPLETED', updatedAt: { gte: start, lte: end } },
    //   orderBy: { updatedAt: 'asc' },
    // });
    // const completionsByDate = new Map<string, { count: number; latest: Date; firstId: string }>();
    // for (const c of completions) {
    //   const date = toDateOnly(c.updatedAt);
    //   const existing = completionsByDate.get(date);
    //   if (existing) {
    //     existing.count += 1;
    //     if (c.updatedAt > existing.latest) existing.latest = c.updatedAt;
    //   } else {
    //     completionsByDate.set(date, { count: 1, latest: c.updatedAt, firstId: c.id });
    //   }
    // }
    // for (const [date, agg] of completionsByDate) {
    //   const description = agg.count > 1 ? `Schedule updated (${agg.count} entries)` : 'Schedule updated';
    //   push(
    //     date,
    //     withId({ type: 'surah_schedule_completion', description, time: agg.latest.toISOString() }, agg.firstId, 'surah_schedule'),
    //   );
    // }

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

    // 4. Surah progress entries — New Lesson, Old Lesson, and Juzh Lesson
    // all funnel through here. One activity entry per real
    // StudentSurahProgressEntry row (not aggregated) so `id` is always a
    // genuine, editable progress-entry id and `record_data` carries full
    // detail (surah, ayah range, grade, remarks) for the UI to render and
    // for the bulk-edit screen to operate on via POST .../update. `type` is
    // always 'surah_progress' so both consumer screens' isSurahProgress
    // filters see it; `lesson_type` (top-level) and `record_data.type`
    // (legacy label) carry the New/Old/Juzh discriminator.
    const surahProgressEntries = await this.prisma.studentSurahProgressEntry.findMany({
      where: {
        studentId,
        type: { in: ['NEW_LESSON', 'OLD_LESSON', 'JUZH_LESSON'] },
        status: { in: ['COMPLETED', 'VERIFIED'] },
      },
      include: {
        surah: { select: { id: true, number: true, nameArabic: true, nameEnglish: true, totalAyahs: true } },
      },
    });

    // For cross-surah Old/Juzh Lesson ranges, `surah` above only resolves
    // the From surah (via surahId) — batch-fetch the To surah's name too so
    // the UI can show "Al-Ikhlas → An-Nas" instead of bare surah numbers.
    const crossSurahToNumbers = [
      ...new Set(
        surahProgressEntries
          .filter((e) => e.surahTo != null && e.surahFrom != null && e.surahTo !== e.surahFrom)
          .map((e) => e.surahTo!),
      ),
    ];
    const toSurahByNumber = new Map<number, { nameEnglish: string; nameArabic: string }>();
    if (crossSurahToNumbers.length > 0) {
      const toSurahs = await this.prisma.surah.findMany({
        where: { number: { in: crossSurahToNumbers } },
        select: { number: true, nameEnglish: true, nameArabic: true },
      });
      for (const s of toSurahs) toSurahByNumber.set(s.number, s);
    }

    for (const e of surahProgressEntries) {
      const at = e.verifiedAt ?? e.completedAt;
      if (!at || at < start || at > end || !e.type) continue;
      const lessonLabel = LESSON_TYPE_LABEL[e.type];
      const ayahCount = e.fromAyah != null && e.toAyah != null ? Math.max(0, e.toAyah - e.fromAyah + 1) : null;

      let description: string;
      if (e.type === 'NEW_LESSON') {
        description = e.surah
          ? `${lessonLabel}: ${e.surah.nameEnglish}${ayahCount ? ` (Ayah ${e.fromAyah}-${e.toAyah})` : ''}`
          : lessonLabel;
      } else {
        let range = '';
        if (e.surahFrom) {
          const isCrossSurah = e.surahTo != null && e.surahTo !== e.surahFrom;
          if (isCrossSurah) {
            const toName = toSurahByNumber.get(e.surahTo!)?.nameEnglish ?? `Surah ${e.surahTo}`;
            const fromName = e.surah?.nameEnglish ?? `Surah ${e.surahFrom}`;
            range = `${fromName} (Ayah ${e.surahFromAyah ?? 1}) → ${toName} (Ayah ${e.surahToAyah ?? '?'})`;
          } else {
            range = `Surah ${e.surahFrom}`;
            if (e.surahFromAyah || e.surahToAyah) range += ` (Ayah ${e.surahFromAyah ?? 1}-${e.surahToAyah ?? '?'})`;
          }
        } else if (e.juzuhFrom) {
          range = `Juz ${e.juzuhFrom}${e.juzuhTo && e.juzuhTo !== e.juzuhFrom ? `-${e.juzuhTo}` : ''}`;
        } else if (e.pageFrom) {
          range = `Page ${e.pageFrom}${e.pageTo && e.pageTo !== e.pageFrom ? `-${e.pageTo}` : ''}`;
        }
        description = range ? `${lessonLabel}: ${range}` : lessonLabel;
      }

      const date = toDateOnly(at);
      push(
        date,
        withId(
          {
            type: 'surah_progress',
            lesson_type: lessonLabel,
            description,
            time: at.toISOString(),
            surah_id: e.surahId,
            total_ayahs: ayahCount,
            record_data: {
              id: e.id,
              surah_id: e.surahId,
              surah_from: e.surahFrom,
              surah_from_ayah: e.surahFromAyah,
              surah_to: e.surahTo,
              surah_to_ayah: e.surahToAyah,
              surah_to_name_en: e.surahTo != null ? toSurahByNumber.get(e.surahTo)?.nameEnglish ?? null : null,
              surah_to_name_ar: e.surahTo != null ? toSurahByNumber.get(e.surahTo)?.nameArabic ?? null : null,
              juzuh_from: e.juzuhFrom,
              juzuh_to: e.juzuhTo,
              page_from: e.pageFrom,
              page_to: e.pageTo,
              from_ayah: e.fromAyah,
              to_ayah: e.toAyah,
              type: lessonLabel,
              grade: e.grade ? GRADE_TO_LEGACY[e.grade] : null,
              completion_status: STATUS_TO_LEGACY[e.status],
              remarks: e.remarks,
              remark_file_url: null,
              completed_at: e.completedAt ? toDateOnly(e.completedAt) : null,
              day: e.day,
              surah: e.surah
                ? {
                    id: e.surah.id,
                    surah_number: e.surah.number,
                    name_ar: e.surah.nameArabic,
                    name_en: e.surah.nameEnglish,
                    total_ayahs: e.surah.totalAyahs,
                  }
                : null,
            },
          },
          e.id,
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
      let description = l.isHalfDay ? 'Half Day Leave approved' : 'Leave approved';
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

    // 7b. Calendar events (branch-wide, e.g. Sports Day — CalendarDay.isEvent,
    // set on the branch/master calendar) — distinct from `type: 'event'`
    // below (a per-student StudentEvent a teacher logs individually).
    // `record_type: 'calendar_event'` keeps the two from colliding for any
    // client filtering on activity type.
    const calendarEvents = await this.prisma.calendarDay.findMany({
      where: { branchId, isEvent: true, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
    for (const ev of calendarEvents) {
      const date = toDateOnly(ev.date);
      const occasion = ev.eventName ?? 'Event';
      push(
        date,
        withId({ type: 'calendar_event', description: `Event: ${occasion}`, date, occasion }, ev.id, 'calendar_event'),
      );
    }

    // 8. Exams (getStudentActivity only)
    if (opts.includeExams) {
      const exams = await this.prisma.studentExam.findMany({
        where: { studentId, examDate: { gte: start, lte: end } },
      });
      for (const ex of exams) {
        const date = toDateOnly(ex.examDate);
        const resultLabel = ex.result ? EXAM_RESULT_DISPLAY[ex.result] : 'N/A';
        let description = `Exam: ${ex.examId ?? 'General'} - Result: ${resultLabel}`;
        if (ex.marks !== null) description += ` (Marks: ${ex.marks})`;
        push(
          date,
          withId(
            {
              type: 'exam',
              description,
              time: toDateOnly(ex.examDate),
              result: ex.result ?? null,
              result_label: resultLabel,
              marks: ex.marks !== null ? Number(ex.marks) : null,
              remarks: ex.remarks,
            },
            ex.id,
            'exam',
          ),
        );
      }
    }

    // 9. Student events (arts day, sports day, etc.) — shown in both
    // getStudentActivityReport and getStudentActivity, same as leaves/
    // holidays, since these are one-off records a teacher marks and expects
    // to see reflected everywhere, not gated behind opts.includeExams.
    const events = await this.prisma.studentEvent.findMany({
      where: { studentId, eventDate: { lte: end } },
    });
    for (const ev of events) {
      const evEnd = ev.eventDateTo ?? ev.eventDate;
      if (evEnd < start) continue; // ends before the queried range starts

      const isMultiDay = toDateOnly(ev.eventDate) !== toDateOnly(evEnd);
      const rangeSuffix = isMultiDay ? ` (${toDateOnly(ev.eventDate)} to ${toDateOnly(evEnd)})` : '';

      // Show once per day it spans within the queried range, same as any
      // other per-day timeline entry.
      const dayStart = ev.eventDate > start ? ev.eventDate : start;
      const dayEnd = evEnd < end ? evEnd : end;
      for (const d = new Date(dayStart); d <= dayEnd; d.setUTCDate(d.getUTCDate() + 1)) {
        const date = toDateOnly(d);
        let description = `Event: ${ev.eventName}${rangeSuffix}`;
        if (ev.remarks) description += ` - ${ev.remarks}`;
        push(
          date,
          withId(
            {
              type: 'event',
              description,
              time: date,
              event_name: ev.eventName,
              event_date_from: toDateOnly(ev.eventDate),
              event_date_to: toDateOnly(evEnd),
              remarks: ev.remarks,
            },
            ev.id,
            'event',
          ),
        );
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
      includeExams: true,
    });
  }

  async getStudentActivity(branchId: string, query: ActivityQueryDto & { student_id: string }) {
    return this.buildActivityTimeline(branchId, query.student_id, query, {
      includeIdAndType: true,
      includeExams: true,
    });
  }

  // ── getStudentActivityReportPdf ──────────────────────────────────────
  /**
   * Downloadable PDF summary: overall (line-weighted) progress plus the
   * day-by-day activity log for a date range. No explicit range → defaults
   * to the branch's current academic year (not "since joining", unlike the
   * plain activity-report endpoint) so "no range selected" reads as "this
   * year's report".
   */
  async getStudentActivityReportPdf(
    branchId: string,
    query: ActivityQueryDto & { student_id: string },
    publicBaseUrl: string,
  ) {
    let effectiveQuery = query;
    if (!query.start_date && !query.end_date && !query.year && !query.month) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { branchId, isCurrent: true },
      });
      if (currentYear) {
        effectiveQuery = {
          ...query,
          start_date: toDateOnly(currentYear.startDate),
          end_date: toDateOnly(currentYear.endDate),
        };
      }
    }

    const [timeline, progress, branch, branchSettings, studentDetails] = await Promise.all([
      this.buildActivityTimeline(branchId, query.student_id, effectiveQuery, {
        includeIdAndType: false,
        includeExams: true,
      }),
      this.surahProgress.getSurahProgressList(branchId, query.student_id),
      this.prisma.branch.findUnique({ where: { id: branchId } }),
      this.prisma.branchSettings.findUnique({ where: { branchId } }),
      this.getStudentDetails(branchId, query.student_id),
    ]);

    mkdirSync(REPORTS_DIR, { recursive: true });
    const fileName = `${query.student_id}-${randomBytes(6).toString('hex')}.pdf`;
    const filePath = join(REPORTS_DIR, fileName);

    const academyName = branchSettings?.displayName || branch?.name || 'Academy';
    const logoPath = this.resolveReportLogoPath(branchSettings?.logoUrl);
    // getStudentDetails' shape isn't formally typed (built from ad-hoc object
    // literals) — read it loosely rather than fighting inferred field types.
    const details = studentDetails.data as {
      student: { gender: string | null };
      student_details: { guardian_name: string | null; father_name: string | null; joining_date: string | null };
      halqa: { name?: string; teacher?: { name?: string } } | null;
      enrollment: { academic_class?: { name?: string }; academic_section?: { name?: string } } | null;
    };

    await this.renderActivityReportPdf(filePath, {
      academyName,
      logoPath,
      generatedAt: new Date(),
      student: {
        name: timeline.data.student.name,
        student_id: timeline.data.student.student_id,
        gender: details.student.gender,
        guardian_name: details.student_details.guardian_name ?? details.student_details.father_name,
        joining_date: details.student_details.joining_date,
        halqa_name: details.halqa?.name ?? null,
        teacher_name: details.halqa?.teacher?.name ?? null,
        academic_class: details.enrollment?.academic_class?.name ?? null,
        academic_section: details.enrollment?.academic_section?.name ?? null,
      },
      dateRange: timeline.data.date_range,
      activities: timeline.data.activities,
      statistics: progress.data.statistics,
    });

    return {
      status: 'success',
      data: {
        url: `${publicBaseUrl}/uploads/reports/${fileName}`,
        from_date: timeline.data.date_range.start,
        to_date: timeline.data.date_range.end,
      },
    };
  }

  /** Local-disk logo path for the report header, or null to fall back to a text-only header. */
  private resolveReportLogoPath(logoUrl: string | null | undefined): string | null {
    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      const candidate = join(process.cwd(), logoUrl.replace(/^\/+/, ''));
      if (existsSync(candidate)) return candidate;
    }
    return existsSync(DEFAULT_LOGO_PATH) ? DEFAULT_LOGO_PATH : null;
  }

  private renderActivityReportPdf(
    filePath: string,
    report: {
      academyName: string;
      logoPath: string | null;
      generatedAt: Date;
      student: {
        name: string;
        student_id: string;
        gender: string | null;
        guardian_name: string | null;
        joining_date: string | null;
        halqa_name: string | null;
        teacher_name: string | null;
        academic_class: string | null;
        academic_section: string | null;
      };
      dateRange: { start: string | null; end: string | null };
      activities: { date: string; activities: Record<string, unknown>[] | undefined }[];
      statistics: Record<string, unknown>;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 0, bufferPages: true, size: 'A4' });
      const stream = createWriteStream(filePath);
      doc.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      // ── Header band ──────────────────────────────────────────────────
      const headerHeight = report.logoPath ? 110 : 90;
      doc.rect(0, 0, pageWidth, headerHeight).fill(BRAND_COLOR);

      let textStartY = 24;
      if (report.logoPath) {
        try {
          doc.image(report.logoPath, pageWidth / 2 - 28, 14, { width: 56, height: 56 });
          textStartY = 74;
        } catch {
          // Corrupt/unreadable logo file — fall back to a text-only header.
        }
      }
      doc
        .fillColor('#FFFFFF')
        .fontSize(20)
        .text(report.academyName, margin, textStartY, { align: 'center', width: contentWidth });
      doc
        .fillColor('#DCEDC8')
        .fontSize(11)
        .text('Student Progress Report', margin, textStartY + 24, { align: 'center', width: contentWidth });

      doc.y = headerHeight + 24;

      // ── Student details card ────────────────────────────────────────
      const cardTop = doc.y;
      const rows: [string, string][] = [
        ['Student Name', report.student.name],
        ['Student ID', report.student.student_id],
        ['Halqa', report.student.halqa_name ?? '—'],
        ['Teacher', report.student.teacher_name ?? '—'],
        ['Class', [report.student.academic_class, report.student.academic_section].filter(Boolean).join(' - ') || '—'],
        ['Gender', report.student.gender ?? '—'],
        ["Guardian's Name", report.student.guardian_name ?? '—'],
        ['Joining Date', report.student.joining_date ?? '—'],
      ];
      const colWidth = contentWidth / 2;
      const rowHeight = 22;
      const cardHeight = Math.ceil(rows.length / 2) * rowHeight + 24;
      doc.roundedRect(margin, cardTop, contentWidth, cardHeight, 6).fillAndStroke('#FAFAFA', '#E0E0E0');

      rows.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margin + 16 + col * colWidth;
        const y = cardTop + 14 + row * rowHeight;
        doc.fontSize(8.5).fillColor('#888').text(label.toUpperCase(), x, y);
        doc.fontSize(11).fillColor('#222').text(value, x, y + 11, { width: colWidth - 24 });
      });
      doc.y = cardTop + cardHeight + 16;

      doc
        .fontSize(9.5)
        .fillColor('#666')
        .text(`Report Period: ${report.dateRange.start ?? '—'}  to  ${report.dateRange.end ?? '—'}`, margin, doc.y, {
          width: contentWidth,
          align: 'center',
        });
      doc.moveDown(1.2);

      // ── Overall progress ─────────────────────────────────────────────
      this.sectionHeading(doc, 'Overall Progress', margin, contentWidth);

      const stats = report.statistics as {
        overall_progress_percentage?: number;
        completed_surahs?: number;
        in_progress_surahs?: number;
        not_started_surahs?: number;
        total_surahs?: number;
      };
      const pct = Math.max(0, Math.min(100, Number(stats.overall_progress_percentage ?? 0)));

      const barY = doc.y + 4;
      const barHeight = 14;
      doc.roundedRect(margin, barY, contentWidth, barHeight, 7).fill('#E0E0E0');
      if (pct > 0) {
        doc.roundedRect(margin, barY, contentWidth * (pct / 100), barHeight, 7).fill(BRAND_COLOR);
      }
      doc
        .fontSize(9)
        .fillColor(pct > 50 ? '#FFFFFF' : '#333')
        .text(`${pct}%`, margin, barY + 3, { width: contentWidth, align: 'center' });
      doc.y = barY + barHeight + 14;

      const chipData: [string, string | number][] = [
        ['Completed', stats.completed_surahs ?? 0],
        ['In Progress', stats.in_progress_surahs ?? 0],
        ['Not Started', stats.not_started_surahs ?? 0],
        ['Total Tracked', stats.total_surahs ?? 0],
      ];
      const chipWidth = contentWidth / chipData.length;
      const chipY = doc.y;
      chipData.forEach(([label, value], i) => {
        const x = margin + i * chipWidth;
        doc.roundedRect(x + 4, chipY, chipWidth - 8, 44, 5).fillAndStroke(BRAND_COLOR_LIGHT, '#C8E6C9');
        doc.fontSize(15).fillColor(BRAND_COLOR).text(String(value), x + 4, chipY + 8, { width: chipWidth - 8, align: 'center' });
        doc.fontSize(8).fillColor('#555').text(label, x + 4, chipY + 27, { width: chipWidth - 8, align: 'center' });
      });
      doc.y = chipY + 44 + 20;

      // ── Activity log ─────────────────────────────────────────────────
      this.sectionHeading(doc, 'Activity Log', margin, contentWidth);
      doc.moveDown(0.3);

      if (report.activities.length === 0) {
        doc.fontSize(10.5).fillColor('#888').text('No activity recorded in this period.', margin);
      }
      for (const day of report.activities) {
        if (doc.y > doc.page.height - 100) doc.addPage();

        doc.fontSize(11).fillColor(BRAND_COLOR).text(day.date, margin, doc.y);
        const lineY = doc.y + 2;
        doc.moveTo(margin, lineY).lineTo(pageWidth - margin, lineY).strokeColor('#E0E0E0').lineWidth(1).stroke();
        doc.moveDown(0.4);

        for (const act of day.activities ?? []) {
          if (doc.y > doc.page.height - 60) doc.addPage();
          doc
            .fontSize(9.5)
            .fillColor('#444')
            .text(`•  ${(act as { description?: string }).description ?? ''}`, margin + 10, doc.y, {
              width: contentWidth - 10,
            });
        }
        doc.moveDown(0.6);
      }

      // ── Footer on every page ────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor('#999')
          .text(
            `Generated on ${report.generatedAt.toLocaleString()}  •  Page ${i + 1} of ${range.count}`,
            margin,
            doc.page.height - 30,
            { width: contentWidth, align: 'center' },
          );
      }

      doc.end();
    });
  }

  private sectionHeading(doc: PDFKit.PDFDocument, title: string, margin: number, contentWidth: number): void {
    doc.fontSize(13).fillColor('#000').text(title, margin, doc.y);
    const y = doc.y + 2;
    doc.moveTo(margin, y).lineTo(margin + contentWidth, y).strokeColor(BRAND_COLOR).lineWidth(1.5).stroke();
    doc.moveDown(0.5);
  }

  // ── getExamReport ─────────────────────────────────────────────────────
  async getExamReport(
    branchId: string,
    userId: string,
    query: GetExamReportQueryDto,
  ) {
    const students = await this.surahProgress.activeStudentsForReport(
      branchId,
      query.halqa_id,
      query.student_id,
      userId,
    );
    const studentIds = students.map((s) => s.id);
    const studentById = new Map(students.map((s) => [s.id, s]));

    const exams = await this.prisma.studentExam.findMany({
      where: {
        branchId,
        studentId: { in: studentIds },
        examDate: {
          gte: new Date(`${query.from_date}T00:00:00.000Z`),
          lte: new Date(`${query.to_date}T23:59:59.999Z`),
        },
      },
      orderBy: { examDate: 'desc' },
    });

    const results = exams.map((e) => {
      const student = studentById.get(e.studentId);
      return {
        id: e.id,
        student: student
          ? {
              id: student.id,
              name: student.name,
              student_id: student.studentCode,
            }
          : { id: e.studentId },
        exam_date: toDateOnly(e.examDate),
        result: e.result ? EXAM_RESULT_DISPLAY[e.result] : null,
        marks: e.marks,
        remarks: e.remarks,
      };
    });

    const passCount = results.filter((r) => r.result === 'Pass').length;
    const failCount = results.filter((r) => r.result === 'fail').length;

    return {
      status: 'success',
      data: {
        date_range: { from_date: query.from_date, to_date: query.to_date },
        filters: {
          halqa_id: query.halqa_id ?? null,
          student_id: query.student_id ?? null,
        },
        summary: {
          total_exams: results.length,
          pass_count: passCount,
          fail_count: failCount,
        },
        exams: results,
      },
    };
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

function serializeEvent(event: {
  id: string;
  studentId: string;
  eventDate: Date;
  eventDateTo: Date | null;
  eventName: string;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    status: 'success',
    message:
      event.createdAt.getTime() === event.updatedAt.getTime()
        ? 'Student event added successfully'
        : 'Student event updated successfully',
    data: {
      id: event.id,
      student_id: event.studentId,
      event_date: toDateOnly(event.eventDate),
      event_date_to: toDateOnly(event.eventDateTo ?? event.eventDate),
      event_name: event.eventName,
      remarks: event.remarks,
    },
  };
}
