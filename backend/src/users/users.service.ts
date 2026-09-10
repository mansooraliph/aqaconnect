import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserAccessContext } from '../rbac/access-control.service';

const SALT_ROUNDS = 10;

export type UserType = 'Employee' | 'Teacher' | 'Student' | 'Staff';

function splitName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.length > 0 ? rest.join(' ') : undefined };
}

function deriveType(user: { employee: unknown; teacher: unknown; student: unknown }): UserType {
  // Teacher wins over Employee: a Teacher-type employee has both an Employee and
  // a linked Teacher record, and "Teacher" is the more specific classification.
  if (user.teacher) return 'Teacher';
  if (user.employee) return 'Employee';
  if (user.student) return 'Student';
  return 'Staff';
}

function withType<T extends { employee: unknown; teacher: unknown; student: unknown }>(
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
    return users.map(withType);
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
      employee: { select: { id: true } },
      teacher: { select: { id: true } },
      student: { select: { id: true } },
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
