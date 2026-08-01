import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Gender } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreTeacherDto } from './dto/store-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

const SALT_ROUNDS = 10;

const includeClause = {
  user: {
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
    },
  },
  employee: { include: { department: true, designation: true } },
} as const;

function randomPassword(): string {
  return randomBytes(8).toString('base64url');
}

function splitName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.length > 0 ? rest.join(' ') : undefined };
}

function toGenderEnum(gender?: 'male' | 'female'): Gender | undefined {
  if (!gender) return undefined;
  return gender === 'male' ? Gender.MALE : Gender.FEMALE;
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.teacher.findMany({
      where: { branchId },
      include: includeClause,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.teacher.findFirst({
      where: { id, branchId },
      include: includeClause,
    });
    if (!record) {
      throw new NotFoundException({ status: 'error', message: 'Teacher not found.' });
    }
    return record;
  }

  /** Next "EMP###" code for this branch — same scheme as the admin Employees module. */
  private async nextEmployeeCode(branchId: string): Promise<string> {
    const employees = await this.prisma.employee.findMany({
      where: { branchId },
      select: { employeeCode: true },
    });
    const maxNumber = employees.reduce((max, e) => {
      const match = /^EMP(\d+)$/i.exec(e.employeeCode);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `EMP${String(maxNumber + 1).padStart(3, '0')}`;
  }

  private async assertUsernameAvailable(username: string, excludeUserId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== excludeUserId) {
      throw new UnprocessableEntityException({
        status: 'error',
        message: 'The username has already been taken.',
      });
    }
  }

  private async assertDepartmentAndDesignationBelongToBranch(
    branchId: string,
    departmentId?: string,
    designationId?: string,
  ) {
    if (departmentId) {
      const department = await this.prisma.department.findFirst({ where: { id: departmentId, branchId } });
      if (!department) {
        throw new UnprocessableEntityException({
          status: 'error',
          message: 'The selected department is invalid.',
        });
      }
    }
    if (designationId) {
      const designation = await this.prisma.designation.findFirst({ where: { id: designationId, branchId } });
      if (!designation) {
        throw new UnprocessableEntityException({
          status: 'error',
          message: 'The selected designation is invalid.',
        });
      }
    }
  }

  async store(branchId: string, dto: StoreTeacherDto) {
    await this.assertUsernameAvailable(dto.username);
    await this.assertDepartmentAndDesignationBelongToBranch(branchId, dto.department, dto.designation);

    const { firstName, lastName } = splitName(dto.name);
    const passwordHash = await bcrypt.hash(dto.password ?? randomPassword(), SALT_ROUNDS);
    const employeeCode = await this.nextEmployeeCode(branchId);

    const teacherId = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username: dto.username, passwordHash, firstName, lastName, phone: dto.mobile, branchId },
      });

      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          branchId,
          employeeCode,
          departmentId: dto.department,
          designationId: dto.designation,
          dateOfJoining: dto.joining_date ? new Date(dto.joining_date) : undefined,
          gender: toGenderEnum(dto.gender),
        },
      });

      const teacher = await tx.teacher.create({
        data: { userId: user.id, branchId, employeeId: employee.id, employeeCode },
      });

      const teacherRole = await tx.role.findUnique({ where: { name: 'Teacher' } });
      if (teacherRole) {
        await tx.userRole.create({ data: { userId: user.id, roleId: teacherRole.id } });
      }

      return teacher.id;
    });

    return this.prisma.teacher.findUniqueOrThrow({ where: { id: teacherId }, include: includeClause });
  }

  async update(branchId: string, id: string, dto: UpdateTeacherDto) {
    const existing = await this.findOne(branchId, id);
    if (dto.username !== undefined) {
      await this.assertUsernameAvailable(dto.username, existing.userId);
    }
    await this.assertDepartmentAndDesignationBelongToBranch(branchId, dto.department, dto.designation);

    const nameParts = dto.name !== undefined ? splitName(dto.name) : undefined;
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, SALT_ROUNDS) : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          ...(dto.username !== undefined && { username: dto.username }),
          ...(nameParts && { firstName: nameParts.firstName, lastName: nameParts.lastName ?? null }),
          ...(dto.mobile !== undefined && { phone: dto.mobile }),
          ...(passwordHash && { passwordHash }),
        },
      });

      if (existing.employeeId) {
        await tx.employee.update({
          where: { id: existing.employeeId },
          data: {
            ...(dto.department !== undefined && { departmentId: dto.department }),
            ...(dto.designation !== undefined && { designationId: dto.designation }),
            ...(dto.joining_date !== undefined && { dateOfJoining: new Date(dto.joining_date) }),
            ...(dto.gender !== undefined && { gender: toGenderEnum(dto.gender) }),
          },
        });
      }
    });

    return this.findOne(branchId, id);
  }

  async destroy(branchId: string, id: string) {
    const existing = await this.findOne(branchId, id);
    await this.prisma.user.delete({ where: { id: existing.userId } });
  }
}
