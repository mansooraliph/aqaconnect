import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ActiveStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileContextService } from '../common/mobile-context.service';
import { parseDdMmYyyy } from '../../common/date';
import { StoreHalqaDto } from './dto/store-halqa.dto';
import { UpdateHalqaDto } from './dto/update-halqa.dto';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { RestoreStudentsDto } from './dto/restore-students.dto';
import { GetUnassignedStudentsQueryDto } from './dto/get-unassigned-students-query.dto';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Legacy `->format('d-m-Y')`. */
function formatDate(date: Date | null): string {
  if (!date) return '';
  return `${pad2(date.getUTCDate())}-${pad2(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
}

/** Legacy `->format('d-m-Y H:i')`. */
function formatDateTime(date: Date | null): string {
  if (!date) return '';
  return `${formatDate(date)} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function toLegacyStatus(status: ActiveStatus): string {
  return status === 'ACTIVE' ? 'active' : 'inactive';
}

function fullName(
  user: { firstName: string; lastName: string | null } | null | undefined,
): string {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

const HALQA_INCLUDE = {
  teacher: {
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  },
  currentClass: { select: { id: true, name: true } },
  addedBy: { select: { firstName: true, lastName: true } },
  lastUpdatedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.HalqaInclude;

type HalqaRow = Prisma.HalqaGetPayload<{ include: typeof HALQA_INCLUDE }>;

@Injectable()
export class MobileHalqasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: MobileContextService,
  ) {}

  private async studentCount(halqaId: string): Promise<number> {
    return this.prisma.halqaStudent.count({
      where: { halqaId, removedAt: null },
    });
  }

  private formatHalqaListItem(halqa: HalqaRow, studentCount: number) {
    return {
      id: halqa.id,
      name: halqa.name,
      teacher_name: fullName(halqa.teacher?.user),
      teacher_id: halqa.teacherId,
      current_class: halqa.currentClass?.name ?? '',
      current_class_id: halqa.currentClassId,
      status: toLegacyStatus(halqa.status),
      start_date: formatDate(halqa.startDate),
      student_count: studentCount,
      added_by: fullName(halqa.addedBy),
      last_updated_by: fullName(halqa.lastUpdatedBy),
      created_at: formatDate(halqa.createdAt),
      updated_at: formatDateTime(halqa.updatedAt),
    };
  }

  async index(branchId: string, userId: string) {
    const isTeacherRole = await this.context.hasRole(userId, 'Teacher');
    const ownTeacher = isTeacherRole
      ? await this.prisma.teacher.findUnique({ where: { userId } })
      : null;

    const where = { branchId, ...(ownTeacher && { teacherId: ownTeacher.id }) };

    const [totalHalqas, activeHalqas, inactiveHalqas, halqas, caller] =
      await Promise.all([
        this.prisma.halqa.count({ where }),
        this.prisma.halqa.count({ where: { ...where, status: 'ACTIVE' } }),
        this.prisma.halqa.count({ where: { ...where, status: 'INACTIVE' } }),
        this.prisma.halqa.findMany({
          where,
          include: HALQA_INCLUDE,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      ]);

    const data = await Promise.all(
      halqas.map(async (halqa) =>
        this.formatHalqaListItem(halqa, await this.studentCount(halqa.id)),
      ),
    );

    return {
      status: 'success',
      user_role: isTeacherRole ? 'teacher' : 'admin',
      user_name: fullName(caller),
      user_id: caller.id,
      total_halqas: totalHalqas,
      active_halqas: activeHalqas,
      inactive_halqas: inactiveHalqas,
      data,
    };
  }

  private async requireHalqa(branchId: string, id: string) {
    const halqa = await this.prisma.halqa.findFirst({
      where: { id, branchId },
      include: HALQA_INCLUDE,
    });
    if (!halqa) {
      throw new NotFoundException('Halqa not found');
    }
    return halqa;
  }

  async getHalqaStudents(branchId: string, halqaId: string, search: string) {
    const halqa = await this.requireHalqa(branchId, halqaId);

    const memberships = await this.prisma.halqaStudent.findMany({
      where: {
        halqaId,
        removedAt: null,
        student: {
          status: 'ACTIVE',
          ...(search && {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { studentCode: { contains: search, mode: 'insensitive' } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }),
        },
      },
      include: {
        student: { include: { user: true } },
        restoreToHalqa: { select: { id: true, name: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });

    const studentsData = memberships.map(
      ({ student, isTemporary, restoreToHalqa }) => ({
        id: student.id,
        name: student.name,
        email: student.user?.email ?? null,
        mobile: student.user?.phone ?? null,
        country_phonecode: null, // legacy: users.country_phonecode — no Country concept in this schema
        gender: student.gender ? student.gender.toLowerCase() : null,
        status: toLegacyStatus(student.status),
        image_url: null, // legacy: asset($student->image_url) — no avatar/upload subsystem in this schema
        created_at: formatDateTime(student.createdAt),
        is_temporary: isTemporary,
        restore_to_halqa: restoreToHalqa
          ? { id: restoreToHalqa.id, name: restoreToHalqa.name }
          : null,
      }),
    );

    return {
      status: 'success',
      data: {
        halqa: {
          id: halqa.id,
          name: halqa.name,
          status: toLegacyStatus(halqa.status),
          start_date: halqa.startDate ? formatDate(halqa.startDate) : null,
          teacher: halqa.teacher
            ? {
                id: halqa.teacherId,
                name: fullName(halqa.teacher.user),
                email: halqa.teacher.user?.email ?? null,
              }
            : null,
          current_class: halqa.currentClass
            ? { id: halqa.currentClass.id, name: halqa.currentClass.name }
            : null,
        },
        students: studentsData,
        meta: {
          search,
          total_students_in_halqa: studentsData.length,
        },
      },
    };
  }

  private async assertTeacherBelongsToBranch(
    branchId: string,
    teacherId: string,
  ) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, branchId },
    });
    if (!teacher) {
      throw new UnprocessableEntityException({
        status: 'error',
        message: 'Selected teacher is invalid or does not have teacher role.',
      });
    }
  }

  private async assertClassBelongsToBranch(branchId: string, classId?: string) {
    if (!classId) return;
    const academicClass = await this.prisma.academicClass.findFirst({
      where: { id: classId, branchId },
    });
    if (!academicClass) {
      throw new UnprocessableEntityException({
        status: 'error',
        message: 'The selected current class is invalid.',
      });
    }
  }

  private async assertNameAvailable(
    branchId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.halqa.findFirst({
      where: { branchId, name, ...(excludeId && { id: { not: excludeId } }) },
    });
    if (existing) {
      throw new UnprocessableEntityException({
        status: 'error',
        message: 'The name has already been taken.',
      });
    }
  }

  async store(branchId: string, userId: string, dto: StoreHalqaDto) {
    await this.assertNameAvailable(branchId, dto.name);
    await this.assertTeacherBelongsToBranch(branchId, dto.teacher_id);
    await this.assertClassBelongsToBranch(branchId, dto.current_class);

    const halqa = await this.prisma.halqa.create({
      data: {
        branchId,
        name: dto.name,
        teacherId: dto.teacher_id,
        startDate: dto.start_date
          ? parseDdMmYyyy(dto.start_date, 'start_date')
          : undefined,
        status: dto.status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
        currentClassId: dto.current_class,
        addedById: userId,
        lastUpdatedById: userId,
      },
      include: HALQA_INCLUDE,
    });

    return halqa;
  }

  async show(branchId: string, id: string) {
    return this.requireHalqa(branchId, id);
  }

  async update(
    branchId: string,
    userId: string,
    id: string,
    dto: UpdateHalqaDto,
  ) {
    await this.requireHalqa(branchId, id);
    if (dto.name !== undefined)
      await this.assertNameAvailable(branchId, dto.name, id);
    if (dto.teacher_id !== undefined)
      await this.assertTeacherBelongsToBranch(branchId, dto.teacher_id);
    if (dto.current_class !== undefined)
      await this.assertClassBelongsToBranch(branchId, dto.current_class);

    return this.prisma.halqa.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.teacher_id !== undefined && { teacherId: dto.teacher_id }),
        ...(dto.start_date !== undefined && {
          startDate: parseDdMmYyyy(dto.start_date, 'start_date'),
        }),
        ...(dto.status !== undefined && {
          status: dto.status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
        }),
        ...(dto.current_class !== undefined && {
          currentClassId: dto.current_class,
        }),
        lastUpdatedById: userId,
      },
      include: HALQA_INCLUDE,
    });
  }

  async destroy(branchId: string, id: string) {
    await this.requireHalqa(branchId, id);
    await this.prisma.$transaction([
      this.prisma.halqaStudent.updateMany({
        where: { halqaId: id, removedAt: null },
        data: { removedAt: new Date() },
      }),
      this.prisma.halqa.delete({ where: { id } }),
    ]);
  }

  async classes(branchId: string) {
    return this.prisma.academicClass.findMany({
      where: { branchId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async assignStudents(
    branchId: string,
    userId: string,
    dto: AssignStudentsDto,
  ) {
    const halqa = await this.prisma.halqa.findFirst({
      where: { id: dto.halqa_id, branchId },
    });
    if (!halqa) {
      throw new NotFoundException({
        status: 'error',
        message: 'Halqa not found or does not belong to your company.',
      });
    }

    const validStudents = await this.prisma.student.findMany({
      where: { id: { in: dto.student_ids }, branchId },
      select: { id: true },
    });
    if (validStudents.length !== dto.student_ids.length) {
      throw new UnprocessableEntityException({
        status: 'error',
        message: 'One or more student detail IDs are invalid or inactive.',
      });
    }

    const validIds = validStudents.map((s) => s.id);
    const isTemporary = dto.is_temporary === true;

    await this.prisma.$transaction(async (tx) => {
      // If this is a temporary move, remember each student's current active
      // halqa (if any) before closing it out, so restoreStudents can send
      // them back later. A normal (non-temporary) assign clears any
      // lingering temporary flag/target instead.
      const priorMemberships = isTemporary
        ? await tx.halqaStudent.findMany({
            where: {
              studentId: { in: validIds },
              removedAt: null,
              NOT: { halqaId: dto.halqa_id },
            },
            select: { studentId: true, halqaId: true },
          })
        : [];
      const restoreTargetByStudent = new Map(
        priorMemberships.map((m) => [m.studentId, m.halqaId]),
      );

      // Legacy overwrites `student_details.halqa_id` unconditionally — same
      // effect here: close out any other active membership, then (re)open
      // one for the target Halqa.
      await tx.halqaStudent.updateMany({
        where: {
          studentId: { in: validIds },
          removedAt: null,
          NOT: { halqaId: dto.halqa_id },
        },
        data: { removedAt: new Date() },
      });

      for (const studentId of validIds) {
        const restoreToHalqaId = isTemporary
          ? (restoreTargetByStudent.get(studentId) ?? null)
          : null;
        const existing = await tx.halqaStudent.findUnique({
          where: { halqaId_studentId: { halqaId: dto.halqa_id, studentId } },
        });
        if (existing) {
          await tx.halqaStudent.update({
            where: { id: existing.id },
            data: {
              removedAt: null,
              assignedAt: new Date(),
              isTemporary,
              restoreToHalqaId,
            },
          });
        } else {
          await tx.halqaStudent.create({
            data: {
              halqaId: dto.halqa_id,
              studentId,
              isTemporary,
              restoreToHalqaId,
            },
          });
        }
      }
    });

    return {
      status: 'success',
      message: isTemporary
        ? `${validIds.length} student(s) temporarily moved to halqa.`
        : `${validIds.length} student(s) successfully assigned to halqa.`,
      data: {
        assigned_student_ids: validIds,
        halqa_id: dto.halqa_id,
        halqa_name: halqa.name,
        is_temporary: isTemporary,
      },
    };
  }

  async restoreStudents(
    branchId: string,
    userId: string,
    dto: RestoreStudentsDto,
  ) {
    const memberships = await this.prisma.halqaStudent.findMany({
      where: {
        studentId: { in: dto.student_ids },
        removedAt: null,
        isTemporary: true,
        halqa: { branchId },
      },
    });
    if (memberships.length === 0) {
      throw new NotFoundException({
        status: 'error',
        message:
          'None of the given students are currently temporarily assigned.',
      });
    }

    const restoredIds: string[] = [];
    const unassignedIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const m of memberships) {
        await tx.halqaStudent.update({
          where: { id: m.id },
          data: {
            removedAt: new Date(),
            isTemporary: false,
            restoreToHalqaId: null,
          },
        });

        if (m.restoreToHalqaId) {
          const existing = await tx.halqaStudent.findUnique({
            where: {
              halqaId_studentId: {
                halqaId: m.restoreToHalqaId,
                studentId: m.studentId,
              },
            },
          });
          if (existing) {
            await tx.halqaStudent.update({
              where: { id: existing.id },
              data: {
                removedAt: null,
                assignedAt: new Date(),
                isTemporary: false,
                restoreToHalqaId: null,
              },
            });
          } else {
            await tx.halqaStudent.create({
              data: { halqaId: m.restoreToHalqaId, studentId: m.studentId },
            });
          }
          restoredIds.push(m.studentId);
        } else {
          // No prior halqa recorded (they were unassigned before the
          // temporary move) — leaving their current membership closed above
          // is enough; they go back to being unassigned.
          unassignedIds.push(m.studentId);
        }
      }
    });

    return {
      status: 'success',
      message: `${restoredIds.length + unassignedIds.length} student(s) restored.`,
      data: {
        restored_student_ids: restoredIds,
        unassigned_student_ids: unassignedIds,
      },
    };
  }

  async getTemporaryStudents(branchId: string) {
    const memberships = await this.prisma.halqaStudent.findMany({
      where: { removedAt: null, isTemporary: true, halqa: { branchId } },
      include: {
        student: { include: { user: true } },
        halqa: { select: { id: true, name: true } },
        restoreToHalqa: { select: { id: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const data = memberships.map((m) => ({
      student_id: m.studentId,
      student_name: m.student.name,
      student_image_url: null,
      current_halqa: { id: m.halqa.id, name: m.halqa.name },
      restore_to_halqa: m.restoreToHalqa
        ? { id: m.restoreToHalqa.id, name: m.restoreToHalqa.name }
        : null,
      assigned_at: formatDateTime(m.assignedAt),
    }));

    return { status: 'success', data };
  }

  async getUnassignedStudents(
    branchId: string,
    query: GetUnassignedStudentsQueryDto,
  ) {
    const search = query.search ?? '';
    const perPage = query.per_page ? Number(query.per_page) : 15;
    const page = query.page ? Number(query.page) : 1;

    const where = {
      branchId,
      status: 'ACTIVE' as const,
      halqaMemberships: { none: { removedAt: null } },
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { studentCode: { contains: search, mode: 'insensitive' as const } },
          { guardianName: { contains: search, mode: 'insensitive' as const } },
          {
            user: { email: { contains: search, mode: 'insensitive' as const } },
          },
        ],
      }),
    };

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: { user: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const data = students.map((student) => ({
      student_detail: {
        id: student.id,
        student_code: student.studentCode,
        father_name: null, // no family-detail fields beyond guardianName/guardianPhone in this schema
        mother_name: null,
        guardian_name: student.guardianName,
        mobile_1: student.guardianPhone,
        mobile_2: null,
        whatsapp: null,
        joining_date: null,
        blood_group: null,
        address: null,
      },
      user: {
        id: student.user?.id ?? null,
        name: student.name,
        email: student.user?.email ?? null,
        mobile: student.user?.phone ?? null,
        status: toLegacyStatus(student.status),
        image_url: null,
        gender: student.gender ? student.gender.toLowerCase() : null,
      },
    }));

    return {
      status: 'success',
      data,
      meta: {
        current_page: page,
        per_page: perPage,
        total,
        last_page: Math.max(1, Math.ceil(total / perPage)),
        search,
      },
    };
  }
}
