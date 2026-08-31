import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

const SALT_ROUNDS = 10;

function splitName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.length > 0 ? rest.join(' ') : undefined };
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  private userSelect() {
    return {
      select: {
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        whatsapp: true,
        isActive: true,
      },
    };
  }

  private includeClause() {
    return {
      user: this.userSelect(),
      employee: true,
    };
  }

  list(branchId: string) {
    return this.prisma.teacher.findMany({
      where: { branchId },
      include: this.includeClause(),
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.teacher.findFirst({
      where: { id, branchId },
      include: this.includeClause(),
    });
    if (!record) {
      throw new NotFoundException('Teacher not found');
    }
    return record;
  }

  private async assertUsernameAvailable(username: string) {
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new ConflictException('That username is already taken.');
    }
  }

  private async assertEmployeeBelongsToBranch(branchId: string, employeeId?: string) {
    if (!employeeId) {
      return;
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, branchId },
    });
    if (!employee) {
      throw new BadRequestException('employeeId must reference an existing Employee in this branch');
    }
  }

  async create(branchId: string, dto: CreateTeacherDto) {
    await this.assertUsernameAvailable(dto.username);
    await this.assertEmployeeBelongsToBranch(branchId, dto.employeeId);

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const { firstName, lastName } = splitName(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          firstName,
          lastName,
          phone: dto.phone,
          whatsapp: dto.whatsapp,
          branchId,
        },
      });

      const teacher = await tx.teacher.create({
        data: {
          userId: user.id,
          branchId,
          employeeCode: dto.employeeCode,
          employeeId: dto.employeeId,
        },
        include: this.includeClause(),
      });

      // Auto-assign the seeded "Teacher" role so the account is immediately
      // usable, per the product decision to grant access on provisioning
      // rather than leaving it as a manual follow-up.
      const teacherRole = await tx.role.findUnique({ where: { name: 'Teacher' } });
      if (teacherRole) {
        await tx.userRole.create({ data: { userId: user.id, roleId: teacherRole.id } });
      }

      return teacher;
    });
  }

  async update(branchId: string, id: string, dto: UpdateTeacherDto) {
    await this.findOne(branchId, id);
    await this.assertEmployeeBelongsToBranch(branchId, dto.employeeId);

    return this.prisma.teacher.update({
      where: { id },
      data: {
        ...(dto.employeeCode !== undefined && { employeeCode: dto.employeeCode }),
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: this.includeClause(),
    });
  }
}
