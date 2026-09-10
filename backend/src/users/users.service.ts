import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserAccessContext } from '../rbac/access-control.service';

const SALT_ROUNDS = 10;

export type UserType = 'Admin' | 'Office Staff' | 'Teacher' | 'Student';

const EMPLOYEE_TYPE_LABELS: Record<string, UserType> = {
  ADMIN: 'Admin',
  OFFICE_STAFF: 'Office Staff',
  TEACHER: 'Teacher',
};

function splitName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.length > 0 ? rest.join(' ') : undefined };
}

function deriveType(user: {
  employee: { employeeType: string } | null;
  teacher: unknown;
  student: unknown;
}): UserType {
  // Teacher wins over Office Staff/Admin: a Teacher-type employee has both an
  // Employee and a linked Teacher record, and "Teacher" is the more specific
  // classification. The employeeType itself already reads "Teacher" for this
  // case, so this only matters if that ever drifts out of sync.
  if (user.teacher) return 'Teacher';
  if (user.employee) return EMPLOYEE_TYPE_LABELS[user.employee.employeeType] ?? 'Office Staff';
  if (user.student) return 'Student';
  // No Employee/Teacher/Student record at all (a bare login created without
  // a branch) — treat the same as a plain Office Staff login rather than a
  // separate "Staff" category.
  return 'Office Staff';
}

function withType<T extends { employee: { employeeType: string } | null; teacher: unknown; student: unknown }>(
  user: T,
): Omit<T, 'employee' | 'teacher' | 'student'> & { type: UserType } {
  const { employee, teacher, student, ...rest } = user;
  return { ...rest, type: deriveType({ employee, teacher, student }) };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(accessContext: UserAccessContext) {
    const users = accessContext.isGlobal
      ? await this.prisma.user.findMany({
          select: this.publicSelect(),
          orderBy: { username: 'asc' },
        })
      : await this.prisma.user.findMany({
          where: { branchId: { in: Array.from(accessContext.allowedBranchIds) } },
          select: this.publicSelect(),
          orderBy: { username: 'asc' },
        });
    return users.map((u) => {
      const { userRoles, ...rest } = u;
      return { ...withType(rest), role: userRoles[0]?.role.name ?? null };
    });
  }

  private publicSelect() {
    return {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      branchId: true,
      lastLoginAt: true,
      createdAt: true,
      employee: { select: { id: true, employeeType: true } },
      teacher: { select: { id: true } },
      student: { select: { id: true } },
      userRoles: { select: { role: { select: { name: true } } } },
    };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('That username is already taken.');
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const { firstName, lastName } = splitName(dto.name);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        firstName,
        lastName,
        phone: dto.phone,
        branchId: dto.branchId,
      },
    });
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...this.publicSelect(), userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return withType(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const { firstName, lastName } = dto.name ? splitName(dto.name) : { firstName: undefined, lastName: undefined };
    await this.prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email: dto.email,
        phone: dto.phone,
        branchId: dto.branchId,
        isActive: dto.isActive,
      },
    });
    return this.findOne(id);
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    await this.findOne(id);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash } }),
      // Force re-login everywhere: a reset password shouldn't leave old sessions valid.
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /** A user has exactly one role: assigning a new one replaces whatever they had. */
  async assignRole(userId: string, dto: AssignRoleDto) {
    await this.findOne(userId);
    return this.prisma.userRole.upsert({
      where: { userId },
      create: { userId, roleId: dto.roleId, branchId: dto.branchId },
      update: { roleId: dto.roleId, branchId: dto.branchId },
      include: { role: true },
    });
  }
}
